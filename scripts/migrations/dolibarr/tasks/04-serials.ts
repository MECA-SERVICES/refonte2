/**
 * Numéros de série en stock : `llx_product_batch` (Dolibarr) → `stock_serial`.
 *
 * Dolibarr range chaque numéro sous une ligne de stock (produit ×
 * emplacement) ; l'inventaire UTILE les y dépose. Les numéros d'une ligne se
 * répartissent entre ses états selon le stock repris (`assignSerials`) ; ceux
 * en trop, gardés par Dolibarr après la sortie de la pièce, sont repris hors
 * stock et listés. À lancer après `stock`.
 *
 * Idempotent par `stock_serial.legacy_doli_id = llx_product_batch.rowid`. Un
 * produit déjà géré dans MSShop garde ses numéros (même règle que `stock`).
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count } from '../../../lib/logger.ts';
import { assignSerials, type Condition } from '../conditions.ts';

interface SourceSerial {
	rowid: number;
	batch: string;
	fk_product: number;
	fk_entrepot: number;
}

export const serialsTask: Task = {
	name: 'serials',
	description: 'Numéros de série en stock (llx_product_batch → stock_serial)',

	async run({ dryRun }) {
		const rows = await sourceQuery<SourceSerial>(
			`SELECT b.rowid, b.batch, ps.fk_product, ps.fk_entrepot
			 FROM ${DOLI}.llx_product_batch b
			 JOIN ${DOLI}.llx_product_stock ps ON ps.rowid = b.fk_product_stock
			 WHERE b.qty > 0`
		);
		log.muted(`${count(rows.length)} numéros de série en source`);

		const sql = targetDb();
		const [products, locations, managedRows] = await Promise.all([
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM product WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM stock_location WHERE legacy_doli_id IS NOT NULL`,
			sql<{ product_id: number }[]>`
				SELECT DISTINCT product_id FROM stock_movement WHERE location_id IS NOT NULL`
		]);
		const productOf = new Map(products.map((p) => [Number(p.doli), p.id]));
		const locationOf = new Map(locations.map((l) => [Number(l.doli), l.id]));
		const managed = new Set(managedRows.map((r) => Number(r.product_id)));

		// Stock repris par la tâche `stock`, ligne par ligne et état par état.
		const stockRows = await sql<
			{ product_id: number; location_id: number; condition: Condition; quantity: number }[]
		>`SELECT product_id, location_id, condition, quantity FROM product_stock WHERE quantity > 0`;
		const stockOf = new Map<string, { condition: Condition; quantity: number }[]>();
		for (const r of stockRows) {
			const key = `${r.product_id}:${r.location_id}`;
			stockOf.set(key, [
				...(stockOf.get(key) ?? []),
				{ condition: r.condition, quantity: r.quantity }
			]);
		}

		// Numéros regroupés par ligne de stock ; un même numéro saisi deux fois ne compte qu'une fois.
		const seen = new Set<string>();
		const byLine = new Map<
			string,
			{ productId: number; locationId: number | null; rows: SourceSerial[] }
		>();
		for (const r of rows) {
			const productId = productOf.get(Number(r.fk_product));
			const serial = r.batch.replace(/[\r\n]/g, '').trim();
			if (!productId || !serial || managed.has(productId)) continue;
			if (seen.has(`${productId}:${serial.toUpperCase()}`)) continue;
			seen.add(`${productId}:${serial.toUpperCase()}`);
			const locationId = locationOf.get(Number(r.fk_entrepot)) ?? null;
			const key = `${productId}:${locationId}`;
			const line = byLine.get(key) ?? { productId, locationId, rows: [] };
			line.rows.push({ ...r, batch: serial });
			byLine.set(key, line);
		}

		const serials: {
			product_id: number;
			serial_number: string;
			location_id: number | null;
			condition: Condition;
			legacy_doli_id: number;
		}[] = [];
		const outOfStock: string[] = [];
		for (const [key, line] of byLine) {
			const assigned = assignSerials(
				line.rows.map((r) => r.batch),
				stockOf.get(key) ?? []
			);
			assigned.forEach((a, i) => {
				if (!a.condition) outOfStock.push(a.serial);
				serials.push({
					product_id: line.productId,
					serial_number: a.serial,
					location_id: a.condition ? line.locationId : null,
					condition: a.condition ?? 'new',
					legacy_doli_id: Number(line.rows[i].rowid)
				});
			});
		}
		log.muted(`${count(serials.length)} numéros rattachés à un produit MSShop`);
		if (outOfStock.length) {
			log.warn(
				`${count(outOfStock.length)} numéros sans pièce en stock dans Dolibarr, repris hors stock : ${outOfStock.join(', ')}`
			);
		}

		if (dryRun) {
			log.warn('Simulation : aucun numéro de série repris.');
			return { processed: 0, note: 'simulation' };
		}

		const imported = [...new Set(products.map((p) => p.id))].filter((id) => !managed.has(id));
		await sql.begin(async (tx) => {
			// Photo Dolibarr : les numéros repris remplacent ceux de la reprise précédente.
			await tx`
				DELETE FROM stock_serial
				WHERE legacy_doli_id IS NOT NULL AND product_id = ANY(${imported})`;
			await tx`
				INSERT INTO stock_serial (product_id, serial_number, location_id, condition, legacy_doli_id)
				SELECT product_id, serial_number, location_id, condition, legacy_doli_id
				FROM jsonb_to_recordset(${tx.json(serials)}) AS s(
					product_id int, serial_number text, location_id int, condition text, legacy_doli_id int)
				ON CONFLICT DO NOTHING`;
		});
		return { processed: serials.length };
	}
};

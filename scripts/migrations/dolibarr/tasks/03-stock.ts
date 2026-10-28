/**
 * Stock par emplacement et par état : `llx_product_stock` + `utile_type_stock`
 * (Dolibarr) → `product_stock`.
 *
 * Chaque ligne Dolibarr (produit, emplacement, quantité) se pose sur le
 * produit MSShop qui porte son `legacy_doli_id` (tâche `products`), répartie
 * entre neuf, occasion et garantie comme dans le module UTILE
 * (`../conditions.ts`).
 *
 * Dolibarr fait foi : à chaque passe, le stock repris remplace celui du
 * produit, `product.stock` devient la somme de ses emplacements, et un produit
 * rangé nulle part passe à 0. Les produits dont le stock change sont listés
 * dans `reports/stock/` pour contrôle.
 *
 * Exception : un produit déjà géré dans MSShop (il a un mouvement avec un
 * emplacement : déplacement, sortie, entrée) n'est plus repris. Dolibarr
 * écraserait ce que le magasin a fait dans MSShop.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count } from '../../../lib/logger.ts';
import { splitByCondition } from '../conditions.ts';

interface SourceStock {
	fk_product: number;
	fk_entrepot: number;
	reel: number | null;
	utile_id: number | null;
	tms: Date;
}

export const stockTask: Task = {
	name: 'stock',
	description: 'Stock par emplacement et par état (llx_product_stock → product_stock)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const rows = await sourceQuery<SourceStock>(
			`SELECT fk_product, fk_entrepot, reel, utile_id, tms FROM ${DOLI}.llx_product_stock`
		);
		const types = await sourceQuery<{ utile_id: number; type: number; quantity: number }>(
			`SELECT utile_id, type, sum(quantity) AS quantity FROM ${DOLI}.utile_type_stock
			 GROUP BY utile_id, type`
		);
		log.muted(`${count(rows.length)} lignes de stock en source`);
		const typesOf = new Map<number, { type: number; quantity: number }[]>();
		for (const t of types) {
			const key = Number(t.utile_id);
			typesOf.set(key, [
				...(typesOf.get(key) ?? []),
				{ type: Number(t.type), quantity: Number(t.quantity) }
			]);
		}

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
		if (managed.size) {
			log.muted(`${count(managed.size)} produits déjà gérés dans MSShop, laissés tels quels`);
		}

		const stock = rows.flatMap((r) => {
			const productId = productOf.get(Number(r.fk_product));
			const locationId = locationOf.get(Number(r.fk_entrepot));
			if (!productId || !locationId || managed.has(productId) || !Number(r.reel)) return [];
			return splitByCondition(Number(r.reel), typesOf.get(Number(r.utile_id)) ?? []).map((s) => ({
				product_id: productId,
				location_id: locationId,
				condition: s.condition,
				quantity: s.quantity,
				updated_at: new Date(r.tms).toISOString()
			}));
		});
		const unmatched = rows.filter((r) => Number(r.reel) && !productOf.has(Number(r.fk_product)));
		const byCondition = stock.reduce<Record<string, number>>(
			(acc, s) => ({ ...acc, [s.condition]: (acc[s.condition] ?? 0) + s.quantity }),
			{}
		);
		log.muted(
			`${count(stock.length)} quantités : neuf ${count(byCondition.new ?? 0)}, occasion ${count(byCondition.used ?? 0)}, garantie ${count(byCondition.warranty ?? 0)} unités`
		);
		if (unmatched.length) {
			log.warn(
				`${count(unmatched.length)} lignes en stock sans produit MSShop : lancer d'abord --only=products`
			);
		}

		if (dryRun) {
			log.warn('Simulation : aucun stock repris.');
			return { processed: 0, note: 'simulation' };
		}

		const imported = [...new Set(products.map((p) => p.id))].filter((id) => !managed.has(id));
		let aligned: StockChange[] = [];
		await sql.begin(async (tx) => {
			// Photo Dolibarr : le stock repris remplace l'ancien, état par état.
			await tx`DELETE FROM product_stock WHERE product_id = ANY(${imported})`;
			await tx`
				INSERT INTO product_stock (product_id, location_id, condition, quantity, updated_at)
				SELECT product_id, location_id, condition, quantity, updated_at
				FROM jsonb_to_recordset(${tx.json(stock)})
				  AS s(product_id int, location_id int, condition text, quantity int, updated_at timestamptz)`;

			// Un seul stock : celui des emplacements. `updated_at` relance la
			// synchronisation de la recherche (« en stock »).
			aligned = await tx<StockChange[]>`
				WITH placed AS (
					SELECT product_id, sum(quantity)::int AS quantity FROM product_stock GROUP BY product_id
				), changed AS (
					SELECT p.id, p.stock AS before, coalesce(s.quantity, 0) AS after
					FROM product p LEFT JOIN placed s ON s.product_id = p.id
					WHERE p.stock <> coalesce(s.quantity, 0)
				)
				UPDATE product AS p SET stock = c.after, updated_at = now()
				FROM changed c WHERE p.id = c.id
				RETURNING p.id, p.reference, p.name, p.type, c.before, c.after`;
		});
		if (aligned.length) {
			const file = writeStockReport(aligned);
			log.muted(`${count(aligned.length)} stocks boutique alignés sur Dolibarr : ${file}`);
		}

		return {
			processed: stock.length,
			note: `${count(aligned.length)} stocks alignés${unmatched.length ? `, ${count(unmatched.length)} lignes sans produit` : ''}`
		};
	}
};

type StockChange = {
	id: number;
	reference: string;
	name: string;
	type: string;
	before: number;
	after: number;
};

/** Liste de contrôle des stocks boutique modifiés, en CSV (séparateur `;`, Excel). */
function writeStockReport(rows: StockChange[]): string {
	const dir = join(process.cwd(), 'reports', 'stock');
	mkdirSync(dir, { recursive: true });
	const file = join(
		dir,
		`alignement-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.csv`
	);
	const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
	const lines = [
		['id', 'reference', 'nom', 'type', 'stock_avant', 'stock_apres'].join(';'),
		...rows.map((r) => [r.id, r.reference, r.name, r.type, r.before, r.after].map(cell).join(';'))
	];
	writeFileSync(file, '\uFEFF' + lines.join('\n') + '\n');
	return file;
}

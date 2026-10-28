/**
 * Stock par emplacement : `llx_product_stock` (Dolibarr) → `product_stock`.
 *
 * Chaque ligne Dolibarr (produit, emplacement, quantité) se pose sur le
 * produit MSShop correspondant (`../products.ts`), qui reçoit au passage son
 * `legacy_doli_id`. Les produits Dolibarr absents de MSShop sont comptés et
 * laissés de côté : ils seront créés à la phase 1.
 *
 * Dolibarr fait foi : à chaque passe, `product.stock` devient la somme de ses
 * emplacements, et un produit rangé nulle part passe à 0. Les produits dont le
 * stock change sont listés dans `reports/stock/` pour contrôle. Tant que
 * Dolibarr reste l'outil du magasin, la reprise est rejouable à volonté (les
 * quantités sont remplacées, y compris par 0).
 *
 * Exception : un produit déjà rangé dans MSShop (il a un mouvement avec un
 * emplacement, ex. un déplacement) n'est plus repris. Dolibarr écraserait ce
 * rangement et poserait le produit à deux endroits.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count } from '../../../lib/logger.ts';
import { compactReference, matchProducts, type ShopProduct } from '../products.ts';

interface SourceStock {
	fk_product: number;
	fk_entrepot: number;
	reel: number | null;
	ref: string;
	barcode: string | null;
	tms: Date;
}

export const stockTask: Task = {
	name: 'stock',
	description: 'Stock par emplacement (llx_product_stock → product_stock)',

	async run({ dryRun }) {
		const rows = await sourceQuery<SourceStock>(
			`SELECT ps.fk_product, ps.fk_entrepot, ps.reel, p.ref, p.barcode, ps.tms
			 FROM ${DOLI}.llx_product_stock ps
			 JOIN ${DOLI}.llx_product p ON p.rowid = ps.fk_product`
		);
		log.muted(`${count(rows.length)} lignes de stock en source`);

		const sql = targetDb();
		const doli = [
			...new Map(
				rows.map((r) => [
					Number(r.fk_product),
					{ rowid: Number(r.fk_product), ref: r.ref, barcode: r.barcode }
				])
			).values()
		];
		const refs = doli.map((d) => d.ref.trim());
		const eans = doli.map((d) => (d.barcode ?? '').trim()).filter(Boolean);
		const compacts = doli.map((d) => compactReference(d.ref)).filter(Boolean);
		const shop = await sql<ShopProduct[]>`
			SELECT id, reference, ean13, is_active AS "isActive" FROM product
			WHERE reference = ANY(${refs}) OR ean13 = ANY(${eans})
			   OR upper(regexp_replace(reference, '[\\s.\\-/_]', '', 'g')) = ANY(${compacts})`;
		const matches = matchProducts(doli, shop);
		const kinds = [...matches.values()].reduce<Record<string, number>>(
			(acc, m) => ({ ...acc, [m.kind]: (acc[m.kind] ?? 0) + 1 }),
			{}
		);
		log.muted(
			`${count(matches.size)} produits rattachés sur ${count(doli.length)} ` +
				`(référence ${kinds.reference ?? 0}, EAN ${kinds.ean ?? 0}, compacte ${kinds.compact ?? 0})`
		);

		const locations = await sql<{ id: number; legacy_doli_id: number }[]>`
			SELECT id, legacy_doli_id FROM stock_location WHERE legacy_doli_id IS NOT NULL`;
		const locationOf = new Map(locations.map((l) => [Number(l.legacy_doli_id), l.id]));

		const managed = new Set(
			(
				await sql<{ product_id: number }[]>`
					SELECT DISTINCT product_id FROM stock_movement WHERE location_id IS NOT NULL`
			).map((r) => Number(r.product_id))
		);
		if (managed.size)
			log.muted(`${count(managed.size)} produits déjà rangés dans MSShop, laissés tels quels`);

		const stock = rows.flatMap((r) => {
			const product = matches.get(Number(r.fk_product));
			const locationId = locationOf.get(Number(r.fk_entrepot));
			if (!product || !locationId || managed.has(product.productId)) return [];
			return [
				{
					product_id: product.productId,
					location_id: locationId,
					quantity: Math.round(Number(r.reel ?? 0)),
					updated_at: new Date(r.tms).toISOString()
				}
			];
		});
		const unmatched = rows.filter(
			(r) => Number(r.reel) !== 0 && !matches.has(Number(r.fk_product))
		);
		log.muted(
			`${count(unmatched.length)} lignes en stock sans produit MSShop (créés à la phase 1)`
		);

		if (dryRun) {
			const [gap] = await sql<{ n: number }[]>`
				SELECT count(*)::int AS n FROM product p
				WHERE p.stock <> coalesce((SELECT sum(quantity) FROM product_stock s WHERE s.product_id = p.id), 0)`;
			log.warn(
				`Simulation : ${count(stock.length)} quantités auraient été reprises, environ ${count(gap.n)} stocks boutique alignés.`
			);
			return { processed: 0, note: 'simulation' };
		}

		let aligned: StockChange[] = [];

		await sql.begin(async (tx) => {
			const links = [...matches].map(([doliId, m]) => ({ product: m.productId, doli: doliId }));
			// Un produit déjà rattaché à un autre produit Dolibarr garde son lien.
			await tx`
				UPDATE product AS p SET legacy_doli_id = link.doli
				FROM jsonb_to_recordset(${tx.json(links)}) AS link(product int, doli int)
				WHERE p.id = link.product AND p.legacy_doli_id IS NULL
				  AND NOT EXISTS (SELECT 1 FROM product o WHERE o.legacy_doli_id = link.doli)`;
			await tx`
				INSERT INTO product_stock (product_id, location_id, quantity, updated_at)
				SELECT product_id, location_id, quantity, updated_at
				FROM jsonb_to_recordset(${tx.json(stock)})
				  AS s(product_id int, location_id int, quantity int, updated_at timestamptz)
				ON CONFLICT (product_id, location_id)
				DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at`;

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
			note: `${count(matches.size)} produits rattachés, ${count(unmatched.length)} lignes sans produit, ${count(aligned.length)} stocks alignés`
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

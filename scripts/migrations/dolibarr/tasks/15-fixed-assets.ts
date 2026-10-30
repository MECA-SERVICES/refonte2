/**
 * Immobilisations UTILE (`utile_immobilisation`) → `fixed_asset` : nom
 * (souvent la référence du produit sorti du stock), désignation avec le n° de
 * série, usage (Atelier, Magasin, Paysage), date d'acquisition, prix d'achat.
 * Le produit MSShop de même référence est rattaché.
 *
 * Idempotent par `fixed_asset.legacy_utile_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { isoDay, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { htmlLines } from '../lines.ts';

interface SourceAsset {
	id: number;
	nom: string;
	description: string | null;
	usage_label: string | null;
	date_acquisition: Date | null;
	prix_achat: number | null;
	prix_compta: number | null;
}

export const fixedAssetsTask: Task = {
	name: 'fixed-assets',
	description: 'Immobilisations (utile_immobilisation → fixed_asset)',

	async run({ dryRun }) {
		const assets = await sourceQuery<SourceAsset>(
			`SELECT i.id, i.nom, i.description, i.usage AS usage_label, i.date_acquisition, i.prix_achat,
			        i.prix_compta
			 FROM ${DOLI}.utile_immobilisation i ORDER BY i.id`
		);
		const sql = targetDb();
		const products = await sql<{ id: number; reference: string }[]>`
			SELECT id, reference FROM product
			WHERE reference = ANY(${assets.map((a) => a.nom.trim())})`;
		const productOf = new Map(products.map((p) => [p.reference, p.id]));
		const rows = assets.map((a) => {
			const acquired = isoDay(a.date_acquisition);
			return {
				legacy_utile_id: Number(a.id),
				name: a.nom.replace(/\s+/g, ' ').trim(),
				description: htmlLines(a.description) || null,
				usage: text(a.usage_label),
				// UTILE met une date nulle au 30/11/1899.
				acquired_on: acquired && acquired >= '2000-01-01' ? acquired : null,
				purchase_price: a.prix_achat ? Number(a.prix_achat).toFixed(2) : null,
				book_value: a.prix_compta ? Number(a.prix_compta).toFixed(2) : null,
				product_id: productOf.get(a.nom.trim()) ?? null
			};
		});
		log.muted(
			`${count(rows.length)} immobilisations, ${count(rows.filter((r) => r.product_id).length)} rattachées à un produit`
		);
		if (dryRun) {
			log.warn('Simulation : aucune immobilisation reprise.');
			return { processed: 0, note: 'simulation' };
		}

		await sql`
			INSERT INTO fixed_asset (legacy_utile_id, name, description, usage, acquired_on,
				purchase_price, book_value, product_id)
			SELECT legacy_utile_id, name, description, usage, acquired_on, purchase_price, book_value,
				product_id
			FROM jsonb_to_recordset(${sql.json(rows)}) AS a(legacy_utile_id int, name text,
				description text, usage text, acquired_on date, purchase_price numeric,
				book_value numeric, product_id int)
			ON CONFLICT (legacy_utile_id) WHERE legacy_utile_id IS NOT NULL DO UPDATE SET
				name = excluded.name, description = excluded.description, usage = excluded.usage,
				acquired_on = excluded.acquired_on, purchase_price = excluded.purchase_price,
				book_value = excluded.book_value, product_id = excluded.product_id, updated_at = now()`;
		return { processed: rows.length, note: `${count(rows.length)} immobilisations` };
	}
};

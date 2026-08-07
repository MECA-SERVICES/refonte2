/**
 * Import des marques : `ps_manufacturer` → `brand`.
 *
 * `brand.legacy_ps_id = ps_manufacturer.id_manufacturer` — c'est la clé de
 * rattachement utilisée ensuite par l'import des produits.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { insertBatched, targetDb } from '../../../lib/target-db.ts';
import { slugify, uniqueSlug, bool, text, date } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

interface SourceBrand {
	id_manufacturer: number;
	name: string;
	active: number;
	date_add: Date | null;
	date_upd: Date | null;
}

export const brandsTask: Task = {
	name: 'brands',
	description: 'Marques (ps_manufacturer → brand)',

	async run({ dryRun }) {
		const rows = await sourceQuery<SourceBrand>(
			`SELECT id_manufacturer, name, active, date_add, date_upd
			 FROM ps_manufacturer
			 ORDER BY id_manufacturer`
		);
		log.muted(`${count(rows.length)} marques en source`);

		// Idempotence : on ne réimporte pas ce qui porte déjà un legacy_ps_id connu.
		const sql = targetDb();
		const existing = await sql<{ slug: string; legacy_ps_id: number | null }[]>`
			SELECT slug, legacy_ps_id FROM brand`;

		const usedSlugs = new Set(existing.map((r) => r.slug));
		const imported = new Set(
			existing.filter((r) => r.legacy_ps_id != null).map((r) => Number(r.legacy_ps_id))
		);

		const toInsert = rows
			.filter((r) => !imported.has(Number(r.id_manufacturer)))
			.map((r) => ({
				name: text(r.name) ?? `Marque ${r.id_manufacturer}`,
				slug: uniqueSlug(slugify(r.name || `marque-${r.id_manufacturer}`), usedSlugs),
				is_active: bool(r.active),
				legacy_ps_id: Number(r.id_manufacturer),
				created_at: date(r.date_add),
				updated_at: date(r.date_upd)
			}));

		if (dryRun) {
			log.warn(`Simulation : ${count(toInsert.length)} marques auraient été insérées.`);
			return { processed: 0, note: 'simulation' };
		}

		const inserted = await insertBatched('brand', toInsert);
		const skipped = rows.length - toInsert.length;
		return { processed: inserted, note: skipped ? `${count(skipped)} déjà importées` : undefined };
	}
};

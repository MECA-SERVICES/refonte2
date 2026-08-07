/**
 * Import des catégories : `ps_category` + `ps_category_lang` → `category`.
 *
 * L'arborescence est reconstruite en **deux passes** : on insère d'abord tous
 * les nœuds sans parent, puis on rattache les `parent_id` une fois que tous les
 * `legacy_ps_id` existent en cible. Une passe unique échouerait sur les parents
 * déclarés après leurs enfants.
 *
 * Note : cet import reprend l'arbre PrestaShop **tel quel**, avec ses défauts
 * (5 948 nœuds, 11 niveaux, 93 % de vides). La refonte de la taxonomie est un
 * chantier distinct — voir `MIGRATION-CATALOGUE.md` §4 et §6 (étapes 2 et 7).
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { insertBatched, targetDb } from '../../../lib/target-db.ts';
import { slugify, uniqueSlug, bool, text, date } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

/** Langue française dans PrestaShop. */
const ID_LANG = 1;

interface SourceCategory {
	id_category: number;
	id_parent: number;
	active: number;
	position: number;
	is_root_category: number;
	name: string | null;
	description: string | null;
	link_rewrite: string | null;
	date_add: Date | null;
	date_upd: Date | null;
}

export const categoriesTask: Task = {
	name: 'categories',
	description: 'Catégories + arborescence (ps_category → category)',

	async run({ dryRun }) {
		const rows = await sourceQuery<SourceCategory>(
			`SELECT c.id_category, c.id_parent, c.active, c.position, c.is_root_category,
			        c.date_add, c.date_upd,
			        cl.name, cl.description, cl.link_rewrite
			 FROM ps_category c
			 LEFT JOIN ps_category_lang cl
			        ON cl.id_category = c.id_category AND cl.id_lang = ${ID_LANG}
			 GROUP BY c.id_category
			 ORDER BY c.level_depth, c.id_category`
		);
		log.muted(`${count(rows.length)} catégories en source`);

		const sql = targetDb();
		const existing = await sql<{ slug: string; legacy_ps_id: number | null }[]>`
			SELECT slug, legacy_ps_id FROM category`;

		const usedSlugs = new Set(existing.map((r) => r.slug));
		const imported = new Set(
			existing.filter((r) => r.legacy_ps_id != null).map((r) => Number(r.legacy_ps_id))
		);

		const toInsert = rows
			.filter((r) => !imported.has(Number(r.id_category)))
			.map((r) => ({
				// parent_id est renseigné en seconde passe.
				name: text(r.name) ?? `Catégorie ${r.id_category}`,
				slug: uniqueSlug(
					slugify(r.link_rewrite || r.name || `categorie-${r.id_category}`),
					usedSlugs
				),
				description: text(r.description),
				is_active: bool(r.active),
				position: Number(r.position) || 0,
				legacy_ps_id: Number(r.id_category),
				created_at: date(r.date_add),
				updated_at: date(r.date_upd)
			}));

		if (dryRun) {
			log.warn(`Simulation : ${count(toInsert.length)} catégories auraient été insérées.`);
			return { processed: 0, note: 'simulation' };
		}

		const inserted = await insertBatched('category', toInsert);
		log.muted(`${count(inserted)} insérées — rattachement des parents…`);

		// --- Seconde passe : parent_id ---
		// Table temporaire + UPDATE ... FROM : une seule requête plutôt que 5 948.
		const links = rows
			.filter((r) => Number(r.id_parent) > 0 && !bool(r.is_root_category))
			.map((r) => ({ child: Number(r.id_category), parent: Number(r.id_parent) }));

		let linked = 0;
		await sql.begin(async (tx) => {
			await tx`CREATE TEMP TABLE tmp_category_parent (child int, parent int)`;

			for (let i = 0; i < links.length; i += 2000) {
				await tx`INSERT INTO tmp_category_parent ${tx(links.slice(i, i + 2000))}`;
			}

			const result = await tx`
				UPDATE category AS c
				   SET parent_id = p.id
				  FROM tmp_category_parent t
				  JOIN category p ON p.legacy_ps_id = t.parent
				 WHERE c.legacy_ps_id = t.child
				   AND c.parent_id IS DISTINCT FROM p.id`;

			linked = result.count;
			await tx`DROP TABLE tmp_category_parent`;
		});

		const skipped = rows.length - toInsert.length;
		return {
			processed: inserted,
			note: `${count(linked)} parents rattachés${skipped ? `, ${count(skipped)} déjà importées` : ''}`
		};
	}
};

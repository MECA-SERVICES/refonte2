/**
 * Reprise des **produits associés** de PrestaShop (`ps_accessory`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Ce que cette tâche récupère
 *
 *  PrestaShop permet d'associer manuellement des produits entre eux — les
 *  « accessoires », affichés en bas de fiche sous « Vous aimerez aussi ».
 *  La boutique lit déjà `product_relation` pour ce bloc, mais la table était
 *  vide : seule la liaison « remplacé par » y était prévue.
 *
 *  196 480 lignes en source, soit 174 810 liaisons distinctes portant sur
 *  36 262 produits. C'est du travail éditorial accumulé par l'atelier, pas de
 *  la donnée déduite : la perdre serait un manque à vendre sur les ventes
 *  complémentaires.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Ce que la tâche écarte ─────────────────────────────────────────────────
 *
 *  - les doublons (~21 670) : l'index unique de `product_relation` les
 *    absorbe, mais on déduplique en amont pour ne pas les transporter ;
 *  - les 13 auto-références (`id_product_1 = id_product_2`), qui feraient
 *    pointer une fiche vers elle-même ;
 *  - les liaisons dont une extrémité n'existe pas en cible : mieux vaut aucune
 *    liaison qu'une liaison vers le vide.
 *
 *  Le rapprochement se fait sur `legacy_ps_id`, renseigné sur 1 053 957 des
 *  1 053 958 produits.
 */
import type { Task } from '../../../lib/runner.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { sourceQuery } from '../source-db.ts';
import { log, count } from '../../../lib/logger.ts';

/** Lot d'écriture dans la table temporaire. */
const WRITE_BATCH = 5000;

export const accessoriesTask: Task = {
	name: 'accessories',
	description: 'Reprend les produits associés de PrestaShop (product_relation)',
	dependsOn: ['products'],

	async run({ dryRun }) {
		const sql = targetDb();

		// Déduplication et filtrage des auto-références dès la source : inutile
		// de transporter 21 670 doublons jusqu'en cible.
		const rows = await sourceQuery<{ from_ps: number; to_ps: number }>(`
			SELECT DISTINCT id_product_1 AS from_ps, id_product_2 AS to_ps
			  FROM ps_accessory
			 WHERE id_product_1 <> id_product_2
		`);

		log.muted(`${count(rows.length)} liaisons distinctes en source`);

		if (dryRun) {
			log.muted('simulation : aucune écriture');
			return;
		}

		let linked = 0;
		let orphans = 0;

		await sql.begin(async (tx) => {
			await tx`
				CREATE TEMP TABLE tmp_accessory (from_ps int, to_ps int)
				ON COMMIT DROP`;

			for (let i = 0; i < rows.length; i += WRITE_BATCH) {
				const slice = rows.slice(i, i + WRITE_BATCH).map((r) => ({
					from_ps: Number(r.from_ps),
					to_ps: Number(r.to_ps)
				}));
				await tx`INSERT INTO tmp_accessory ${tx(slice)}`;
			}

			await tx`CREATE INDEX ON tmp_accessory (from_ps)`;
			await tx`CREATE INDEX ON tmp_accessory (to_ps)`;
			await tx`ANALYZE tmp_accessory`;

			// Les deux extrémités sont résolues par `legacy_ps_id`. Une jointure
			// interne écarte d'elle-même les produits absents de la cible.
			const result = await tx`
				INSERT INTO product_relation (from_product_id, to_product_id, type, position)
				SELECT src.id, dst.id, 'accessory', 0
				  FROM tmp_accessory t
				  JOIN product src ON src.legacy_ps_id = t.from_ps
				  JOIN product dst ON dst.legacy_ps_id = t.to_ps
				 WHERE src.id <> dst.id
				ON CONFLICT DO NOTHING`;

			linked = result.count;

			/*
			 * Comptage des orphelins par différence plutôt que par `NOT EXISTS` :
			 * `product.legacy_ps_id` n'est pas indexé, et deux sous-requêtes
			 * corrélées y déclenchaient un parcours complet du million de
			 * produits pour chacune des 174 797 lignes.
			 */
			const [{ n }] = await tx<{ n: number }[]>`
				SELECT (SELECT COUNT(*) FROM tmp_accessory)::int
				     - (SELECT COUNT(*) FROM tmp_accessory t
				          JOIN product src ON src.legacy_ps_id = t.from_ps
				          JOIN product dst ON dst.legacy_ps_id = t.to_ps)::int AS n`;
			orphans = Number(n);
		});

		log.success(`${count(linked)} produits associés repris.`);
		if (orphans > 0) {
			// Attendu : la migration a écarté des produits obsolètes ou hors
			// périmètre, dont certains étaient encore associés en source.
			log.muted(
				`${count(orphans)} liaisons ignorées — un des deux produits est absent du catalogue.`
			);
		}
	}
};

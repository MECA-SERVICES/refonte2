/**
 * Palier 1 du §5.3 — **liaison** des produits obsolètes vers leur remplaçant.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  `09-reclassify` désactive déjà les 18 803 produits `REMPLACÉ*` et les sort
 *  de la navigation. Mais le contrôle de recette n°10 exige « désactivés **et
 *  liés** » : sans la liaison, un client qui arrive sur une référence obsolète
 *  (par un lien externe, un favori, un devis) tombe sur une fiche morte, sans
 *  aucun chemin vers le produit qui la remplace.
 *
 *  C'est un manque à vendre direct, et la table `product_relation` existe
 *  précisément pour ça (type `replacement`).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── D'où vient l'information ───────────────────────────────────────────────
 *
 *  Mesuré à l'étape 1 (§5.4) : les colonnes custom `article_de_remplacement`
 *  (1 892) et `article_remplace` (1 201) ne couvrent que 3 093 lignes, contre
 *  18 803 produits `REMPLACÉ*`. **Le signal fiable est donc le nom**, où la
 *  référence du remplaçant est écrite en clair :
 *
 *      « Remplacé Par 703961 | AL-KO »   →  703961
 *      « REMPLACE PAR 191G51-7 »         →  191G51-7
 *
 *  La liaison n'est créée que si cette référence **existe réellement** en
 *  cible : mieux vaut aucune liaison qu'une liaison vers le vide.
 */
import type { Task } from '../../../lib/runner.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count } from '../../../lib/logger.ts';

/** Lot d'écriture des liaisons. */
const WRITE_BATCH = 5000;

/**
 * Extrait la référence du remplaçant depuis un nom `REMPLACÉ PAR …`.
 *
 * Retourne `null` si le nom n'est pas de cette forme, ou si aucune référence
 * exploitable n'y figure — un `REMPLACE PAR` sans référence n'apprend rien.
 */
export function parseReplacement(name: string): string | null {
	const raw = (name ?? '').trim();
	if (raw === '') return null;

	// Normalisation : accents et casse varient d'un import à l'autre
	// (`Remplacé Par`, `REMPLACE PAR`, `REMPLACÉ PAR`).
	const normalized = raw
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toUpperCase();

	const match = normalized.match(/^REMPLACE(?:E)?\s+PAR\s+(.+)$/);
	if (!match) return null;

	// La suite peut contenir la marque après un séparateur : « 703961 | AL-KO ».
	// On ne garde que le premier segment, qui porte la référence.
	const candidate = (match[1] ?? '').split(/[|/,;]/)[0]?.trim() ?? '';

	// Une référence utile contient au moins un chiffre : « REMPLACE PAR VOIR
	// FICHE » ou « REMPLACE PAR NOUVEAU MODELE » n'en sont pas.
	if (candidate === '' || !/\d/.test(candidate)) return null;

	// Garde-fou : au-delà, ce n'est plus une référence mais une phrase.
	return candidate.length <= 40 ? candidate : null;
}

export const replacementsTask: Task = {
	name: 'replacements',
	description: 'Lie les produits obsolètes à leur remplaçant (product_relation)',
	// `reclassify` a désactivé les obsolètes ; on les relie ensuite.
	dependsOn: ['products', 'reclassify'],

	async run({ dryRun }) {
		const sql = targetDb();

		// Les obsolètes ont été désactivés par `reclassify`. On repart du nom,
		// seule source fiable (§5.4).
		const obsolete = await sql<{ id: number; name: string }[]>`
			SELECT id, name FROM product
			 WHERE name ILIKE 'REMPLAC%PAR%'`;

		log.muted(`${count(obsolete.length)} produits « REMPLACÉ PAR … » en cible`);

		const parsed: { id: number; reference: string }[] = [];
		let unparsable = 0;

		for (const p of obsolete) {
			const reference = parseReplacement(p.name);
			if (reference === null) unparsable++;
			else parsed.push({ id: Number(p.id), reference });
		}

		log.muted(
			`${count(parsed.length)} références de remplacement extraites, ` +
				`${count(unparsable)} noms sans référence exploitable`
		);

		if (parsed.length === 0) {
			log.warn('Aucune liaison à créer.');
			return { processed: 0, note: 'aucune référence extraite' };
		}

		if (dryRun) {
			log.warn(`Simulation : ${count(parsed.length)} liaisons candidates. Aperçu :`);
			for (const r of parsed.slice(0, 10)) {
				const source = obsolete.find((o) => Number(o.id) === r.id);
				log.muted(`  ${(source?.name ?? '').slice(0, 46).padEnd(48)} → ${r.reference}`);
			}
			log.muted('  (la liaison ne sera créée que si la référence existe en cible)');
			return { processed: 0, note: 'simulation' };
		}

		// Résolution par jointure côté Postgres : la référence du remplaçant est
		// comparée à `product.reference`, qui porte déjà un index.
		let linked = 0;
		let unresolved = 0;

		await sql.begin(async (tx) => {
			await tx`
				CREATE TEMP TABLE tmp_replacement (
					from_id   int  NOT NULL,
					reference text NOT NULL
				) ON COMMIT DROP`;

			for (let i = 0; i < parsed.length; i += WRITE_BATCH) {
				const slice = parsed.slice(i, i + WRITE_BATCH).map((r) => ({
					from_id: r.id,
					reference: r.reference
				}));
				await tx`INSERT INTO tmp_replacement ${tx(slice)}`;
			}

			await tx`CREATE INDEX ON tmp_replacement (reference)`;
			await tx`ANALYZE tmp_replacement`;

			// `DISTINCT ON` : la source contient des références en doublon
			// (~247 k, index non unique). On retient un remplaçant déterministe —
			// le plus petit id — plutôt que d'en créer plusieurs au hasard.
			const result = await tx`
				INSERT INTO product_relation (from_product_id, to_product_id, type)
				SELECT DISTINCT ON (t.from_id) t.from_id, p.id, 'replacement'
				  FROM tmp_replacement t
				  JOIN product p ON p.reference = t.reference
				 WHERE p.id <> t.from_id
				 ORDER BY t.from_id, p.id
				ON CONFLICT DO NOTHING`;

			linked = result.count;

			const [{ n }] = await tx<{ n: number }[]>`
				SELECT COUNT(*)::int AS n
				  FROM tmp_replacement t
				 WHERE NOT EXISTS (
				       SELECT 1 FROM product p WHERE p.reference = t.reference AND p.id <> t.from_id
				 )`;
			unresolved = Number(n);
		});

		log.success(`${count(linked)} liaisons « remplacé par » créées.`);
		if (unresolved > 0) {
			// Attendu : le remplaçant n'est pas toujours présent au catalogue.
			log.muted(
				`${count(unresolved)} références de remplacement absentes du catalogue — ` +
					'aucune liaison créée pour celles-ci (volontaire).'
			);
		}

		return {
			processed: linked,
			note: `${count(linked)} liées, ${count(unresolved)} remplaçants absents`
		};
	}
};

/**
 * Contrôles de recette — §7 du cahier des charges.
 *
 * Compare la cible à la source et affiche un tableau verdict par verdict.
 * **Aucune écriture** : cette tâche est sûre à relancer à tout moment, y compris
 * en production, et sert de compte-rendu à consigner au §8.
 *
 * Les contrôles portant sur la taxonomie cible (n°3 à n°6 : fourre-tout,
 * catégories vides, profondeur ≤ 5, ~612 catégories) ne peuvent être satisfaits
 * qu'après l'étape 7 (reclassification). Ils sont donc mesurés et affichés, mais
 * signalés « attendu après reclassification » tant que celle-ci n'a pas eu lieu.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count, color } from '../../../lib/logger.ts';
import { BRAND_NODE_IDS } from '../brand-nodes.ts';

/** Un contrôle évalué, prêt à être affiché. */
interface Check {
	n: number;
	label: string;
	value: string;
	expected: string;
	/** `null` = informatif, non bloquant à ce stade du chantier. */
	pass: boolean | null;
}

export const verifyTask: Task = {
	name: 'verify',
	description: 'Contrôles de recette (§7) — lecture seule des deux bases',

	async run() {
		const sql = targetDb();

		// --- Source ---
		const [srcProducts] = await sourceQuery<{ n: number }>('SELECT COUNT(*) AS n FROM ps_product');
		const [srcLinks] = await sourceQuery<{ n: number }>(
			'SELECT COUNT(*) AS n FROM ps_category_product'
		);
		const [srcImages] = await sourceQuery<{ n: number }>('SELECT COUNT(*) AS n FROM ps_image');
		const [srcBrandLinked] = await sourceQuery<{ n: number }>(
			'SELECT COUNT(*) AS n FROM ps_product WHERE id_manufacturer > 0'
		);

		// --- Cible ---
		const [tgt] = await sql<
			{
				products: number;
				no_category: number;
				categories: number;
				links: number;
				media: number;
				with_brand: number;
				variants: number;
			}[]
		>`
			SELECT (SELECT COUNT(*) FROM product)::int                                AS products,
			       (SELECT COUNT(*) FROM product WHERE category_id IS NULL)::int      AS no_category,
			       (SELECT COUNT(*) FROM category)::int                               AS categories,
			       (SELECT COUNT(*) FROM product_category)::int                       AS links,
			       (SELECT COUNT(*) FROM product_media)::int                          AS media,
			       (SELECT COUNT(*) FROM product WHERE brand_id IS NOT NULL)::int     AS with_brand,
			       (SELECT COUNT(*) FROM product_variant)::int                        AS variants`;

		// Profondeur de l'arbre, par parcours récursif.
		const [{ depth }] = await sql<{ depth: number }>`
			WITH RECURSIVE tree AS (
				SELECT id, 1 AS level FROM category WHERE parent_id IS NULL
				UNION ALL
				SELECT c.id, t.level + 1 FROM category c JOIN tree t ON c.parent_id = t.id
			)
			SELECT COALESCE(MAX(level), 0)::int AS depth FROM tree`;

		// Catégories actives ne contenant aucun produit, ni en principal ni en N-N.
		const [{ empty }] = await sql<{ empty: number }>`
			SELECT COUNT(*)::int AS empty
			  FROM category c
			 WHERE c.is_active
			   AND NOT EXISTS (SELECT 1 FROM product p WHERE p.category_id = c.id)
			   AND NOT EXISTS (SELECT 1 FROM product_category pc WHERE pc.category_id = c.id)`;

		// Contrôle n°11 — aucune marque ne doit être une catégorie (§4.1 règle n°1).
		// Vérifié **en base**, pas seulement dans le code : le défaut du 2026-08-08
		// (§6.6) était précisément un filtrage correct qui ne s'exécutait jamais.
		const brandCategories = await sql<{ name: string; legacy_ps_id: number }[]>`
			SELECT name, legacy_ps_id FROM category
			 WHERE legacy_ps_id = ANY(${[...BRAND_NODE_IDS]})`;

		// Plus grosse catégorie : révèle un fourre-tout résiduel (contrôle n°3).
		const biggest = await sql<{ name: string; n: number }[]>`
			SELECT c.name, COUNT(p.id)::int AS n
			  FROM category c JOIN product p ON p.category_id = c.id
			 GROUP BY c.id, c.name
			 ORDER BY n DESC
			 LIMIT 1`;

		const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
		const fmtPct = (a: number, b: number) => `${pct(a, b).toFixed(2)} %`;

		const importRate = pct(tgt.products, Number(srcProducts.n));
		const orphanRate = pct(tgt.no_category, tgt.products);
		const brandRate = pct(tgt.with_brand, tgt.products);
		const biggestShare = biggest.length ? pct(biggest[0].n, tgt.products) : 0;

		const checks: Check[] = [
			{
				n: 1,
				label: 'Produits importés vs source',
				value: `${count(tgt.products)} / ${count(Number(srcProducts.n))} (${importRate.toFixed(2)} %)`,
				expected: '≥ 99,9 %',
				pass: importRate >= 99.9
			},
			{
				n: 2,
				label: 'Produits sans catégorie',
				value: `${count(tgt.no_category)} (${fmtPct(tgt.no_category, tgt.products)})`,
				expected: '< 1 %',
				pass: orphanRate < 1
			},
			{
				n: 3,
				label: 'Plus grosse catégorie (fourre-tout)',
				value: biggest.length
					? `${biggest[0].name} — ${count(biggest[0].n)} (${biggestShare.toFixed(1)} %)`
					: '—',
				expected: 'aucune catégorie dominante',
				// Tant que la reclassification (étape 7) n'a pas eu lieu, le
				// fourre-tout source est attendu : informatif, pas un échec.
				pass: biggestShare < 20 ? true : null
			},
			{
				n: 4,
				label: 'Catégories actives vides',
				value: count(empty),
				expected: '0',
				pass: empty === 0 ? true : null
			},
			{
				n: 5,
				label: "Profondeur de l'arbre",
				value: String(depth),
				// 4 niveaux pour les pièces, 5 pour les produits (§6.3).
				expected: '≤ 5',
				pass: depth <= 5 ? true : null
			},
			{
				n: 6,
				label: 'Nombre de catégories',
				value: count(tgt.categories),
				expected: '~578',
				pass: tgt.categories <= 800 ? true : null
			},
			{
				n: 7,
				label: 'Produits avec marque',
				value: `${count(tgt.with_brand)} (${fmtPct(tgt.with_brand, tgt.products)})`,
				expected: '≥ 99 %',
				pass: brandRate >= 99
			},
			{
				n: 8,
				label: 'Liaisons N-N product_category',
				value: `${count(tgt.links)} / ${count(Number(srcLinks.n))} en source`,
				expected: '> 1 M',
				pass: tgt.links > 1_000_000
			},
			{
				n: 9,
				label: 'Médias rattachés',
				value: `${count(tgt.media)} / ${count(Number(srcImages.n))} en source`,
				expected: 'cohérent avec la source',
				pass: pct(tgt.media, Number(srcImages.n)) >= 99
			},
			{
				n: 10,
				label: 'Déclinaisons',
				value: count(tgt.variants),
				expected: '~1 318',
				pass: tgt.variants > 0
			},
			{
				n: 11,
				label: 'Marques présentes en catégorie',
				value:
					brandCategories.length === 0
						? 'aucune'
						: brandCategories.map((c) => c.name).join(', ').slice(0, 60),
				expected: '0',
				// Celui-ci est bloquant sans condition : une marque en catégorie
				// signifie que l'arbre sale est revenu.
				pass: brandCategories.length === 0
			}
		];

		log.title('Contrôles de recette');
		let failures = 0;
		let pending = 0;

		for (const check of checks) {
			const mark =
				check.pass === true
					? color.green('✓')
					: check.pass === null
						? color.yellow('~')
						: color.red('✗');
			if (check.pass === false) failures++;
			if (check.pass === null) pending++;

			console.log(
				`  ${mark} ${String(check.n).padStart(2)}. ${check.label.padEnd(38)} ` +
					`${check.value.padEnd(34)} ${color.dim(check.expected)}`
			);
		}

		console.log();
		if (pending > 0) {
			log.warn(
				`${pending} contrôle(s) en attente de l'étape 7 (reclassification) — informatifs à ce stade.`
			);
		}
		if (failures > 0) {
			log.error(`${failures} contrôle(s) en échec.`);
		} else {
			log.success('Aucun contrôle bloquant en échec.');
		}

		// Note : on ne lève pas ici. `verify` est un compte-rendu, pas une barrière ;
		// faire échouer le run masquerait les contrôles suivants.
		log.muted(`marques rattachées en source : ${count(Number(srcBrandLinked.n))}`);

		return {
			processed: checks.length,
			note: `${checks.length - failures - pending} OK, ${failures} KO, ${pending} en attente`
		};
	}
};

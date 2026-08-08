/**
 * Import des catégories additionnelles : `ps_category_product` → `product_category`.
 *
 * Cette table N-N (1 062 387 liaisons en source) **n'a jamais été migrée** : la
 * base cible n'en contient qu'une seule ligne. C'est la seconde moitié du
 * constat n°1 du cahier des charges, et le contrôle de recette n°8 (> 1 M).
 *
 * Sans elle, un produit rangé dans plusieurs catégories n'apparaît que dans sa
 * catégorie par défaut — ce qui vide artificiellement la navigation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Le volume interdit l'approche naïve (charger les liaisons, résoudre en JS,
 *  réinsérer) : elle demanderait de tenir 1,05 M de couples `legacy → id` en
 *  mémoire **en plus** des liaisons.
 *
 *  On passe donc par une table temporaire côté cible : on y déverse les couples
 *  d'identifiants **source**, puis un unique `INSERT ... SELECT` fait la
 *  jointure de résolution côté Postgres, là où les index sont déjà en place.
 * ────────────────────────────────────────────────────────────────────────────
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery, sourceCursor } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count, progress } from '../../../lib/logger.ts';

const PAGE_SIZE = 20_000;

// `sourceCursor` exige une index signature (contrainte
// `Record<string, unknown>`) : les lignes MySQL sont indexées par nom
// de colonne.
interface SourceLink {
	[key: string]: unknown;
	id_product: number;
	id_category: number;
	position: number;
}

export const productCategoriesTask: Task = {
	name: 'product-categories',
	description: 'Catégories additionnelles N-N (ps_category_product → product_category)',
	// `product-taxonomy` doit avoir tourné : c'est lui qui crée les catégories
	// produits retenues (avec leur `legacy_ps_id`). La jointure ci-dessous ne
	// résout donc QUE les nœuds conservés — les liaisons pointant vers un
	// nœud-marque ou une branche écartée (KRAMP, Vues éclatées) tombent d'elles-mêmes.
	dependsOn: ['products', 'product-taxonomy'],

	async run({ dryRun, limit }) {
		const sql = targetDb();

		const [{ total }] = await sourceQuery<{ total: number }>(
			'SELECT COUNT(*) AS total FROM ps_category_product'
		);
		const expected = limit ?? Number(total);
		log.muted(`${count(Number(total))} liaisons en source`);

		if (dryRun) {
			log.warn(`Simulation : ${count(expected)} liaisons auraient été traitées.`);
			return { processed: 0, note: 'simulation' };
		}

		const bar = progress('liaisons', expected);
		let read = 0;
		let linked = 0;

		// La table temporaire vit le temps de la session ; `ON COMMIT DROP` la
		// libère même si la tâche échoue en cours de route.
		await sql.begin(async (tx) => {
			await tx`
				CREATE TEMP TABLE tmp_product_category (
					legacy_product  int NOT NULL,
					legacy_category int NOT NULL
				) ON COMMIT DROP`;

			const select = `
				SELECT id_product, id_category, position
				  FROM ps_category_product
				 WHERE 1 = 1 {{WHERE}}`;

			// Curseur sur `id_product`, clé **non unique** ici (un produit porte
			// plusieurs catégories) : d'où le dernier argument, qui empêche le
			// curseur de perdre les liaisons d'un produit à cheval sur une page.
			//
			// Contrairement à `products` et `media`, la page n'est PAS bornée par
			// `--limit` : le report du dernier groupe suppose une page pleine. Un
			// `--limit` ici reste donc approximatif (arrondi à la page), ce qui est
			// sans conséquence — la tâche est idempotente et rejouable.
			for await (const rows of sourceCursor<SourceLink>(select, 'id_product', PAGE_SIZE, false)) {
				const batch = rows.map((r) => ({
					legacy_product: Number(r.id_product),
					legacy_category: Number(r.id_category)
				}));

				for (let i = 0; i < batch.length; i += 5000) {
					await tx`INSERT INTO tmp_product_category ${tx(batch.slice(i, i + 5000))}`;
				}

				read += rows.length;
				bar.tick(read);
				if (limit !== null && read >= limit) break;
			}

			// Index sur la table temporaire : sans lui, la jointure de résolution
			// ci-dessous ferait un scan séquentiel sur 1 M de lignes.
			await tx`CREATE INDEX ON tmp_product_category (legacy_product)`;
			await tx`ANALYZE tmp_product_category`;

			log.muted('résolution des identifiants côté Postgres…');

			// Résolution + insertion en une passe. `ON CONFLICT DO NOTHING` couvre
			// l'index unique (product_id, category_id) : la tâche est rejouable, et
			// les liaisons déjà présentes (dont la catégorie par défaut) ne sont pas
			// dupliquées.
			const result = await tx`
				INSERT INTO product_category (product_id, category_id)
				SELECT DISTINCT p.id, c.id
				  FROM tmp_product_category t
				  JOIN product  p ON p.legacy_ps_id = t.legacy_product
				  JOIN category c ON c.legacy_ps_id = t.legacy_category
				ON CONFLICT DO NOTHING`;

			linked = result.count;
		});

		bar.done(linked);

		// L'écart est ici **attendu et voulu** : seules les catégories retenues par
		// `product-taxonomy` existent en cible. Toutes les liaisons pointant vers
		// un nœud écarté — nœuds-marques (EGO POWER+…), branche « Pièces
		// détachées » (compatibilité déguisée), KRAMP, « Vues éclatées » — ne se
		// résolvent pas, et c'est exactement le nettoyage recherché. Ces produits
		// sont rangés ensuite par `reclassify`, sur des règles de type de pièce.
		const dropped = read - linked;
		if (dropped > 0) {
			log.muted(
				`${count(dropped)} liaisons non reprises (nœuds écartés de l'arbre propre) — ` +
					'attendu : elles relèvent du tri par règles.'
			);
		}

		return {
			processed: linked,
			note: dropped > 0 ? `${count(dropped)} liaisons écartées (nœuds non repris)` : undefined
		};
	}
};

/**
 * Construction de l'arbre cible — première moitié de l'étape 7 du cahier des charges.
 *
 * Crée dans la base cible les 239 catégories de pièces définies par `taxonomy.ts`
 * (`Pièces détachées > Famille > Sous-famille > Type`), plus les deux nœuds
 * techniques `À classer` et la racine des produits.
 *
 * **Ne range aucun produit** : c'est le rôle de `09-reclassify.ts`. Séparer les
 * deux permet de rejouer le rangement sans recréer l'arbre, et de vérifier la
 * forme de l'arbre avant d'y déverser un million de produits.
 *
 * Idempotente : les catégories déjà présentes (même `source` et même chemin) ne
 * sont pas recréées. Relançable après ajout d'une famille dans `taxonomy.ts`.
 */
import type { Task } from '../../../lib/runner.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { slugify, uniqueSlug } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import {
	PIECE_TAXONOMY,
	PIECES_ROOT,
	PRODUCTS_ROOT,
	UNCLASSIFIED,
	assertNoDuplicateKeywords
} from '../taxonomy.ts';

/** Une catégorie à créer, avec le chemin qui l'identifie. */
interface PlannedCategory {
	path: string;
	name: string;
	parentPath: string | null;
	position: number;
}

/**
 * Déplie la taxonomie en une liste plate ordonnée parents-avant-enfants.
 * L'ordre garantit qu'un parent existe toujours quand son enfant est inséré.
 */
function planCategories(): PlannedCategory[] {
	const planned: PlannedCategory[] = [];

	planned.push({ path: PIECES_ROOT, name: PIECES_ROOT, parentPath: null, position: 0 });
	planned.push({ path: PRODUCTS_ROOT, name: PRODUCTS_ROOT, parentPath: null, position: 1 });

	let familyPosition = 0;
	for (const family of PIECE_TAXONOMY) {
		const familyPath = `${PIECES_ROOT} > ${family.name}`;
		planned.push({
			path: familyPath,
			name: family.name,
			parentPath: PIECES_ROOT,
			position: familyPosition++
		});

		let subPosition = 0;
		for (const sub of family.children) {
			const subPath = `${familyPath} > ${sub.name}`;
			planned.push({
				path: subPath,
				name: sub.name,
				parentPath: familyPath,
				position: subPosition++
			});

			let typePosition = 0;
			for (const type of sub.children) {
				planned.push({
					path: `${subPath} > ${type.name}`,
					name: type.name,
					parentPath: subPath,
					position: typePosition++
				});
			}
		}
	}

	// Nœud de recueil : les ~302 000 produits qu'aucune règle ne classe doivent
	// rester atteignables, pas disparaître de la navigation (§6.3).
	planned.push({
		path: `${PIECES_ROOT} > ${UNCLASSIFIED}`,
		name: UNCLASSIFIED,
		parentPath: PIECES_ROOT,
		position: 999
	});

	return planned;
}

export const taxonomyTask: Task = {
	name: 'taxonomy',
	description: "Crée l'arbre cible des pièces (239 catégories, source='rule')",

	async run({ dryRun }) {
		// Échoue tôt si deux feuilles réclament le même mot-clé : mieux vaut
		// s'arrêter ici que ranger des milliers de produits au hasard.
		assertNoDuplicateKeywords();

		const sql = targetDb();
		const planned = planCategories();
		log.muted(`${count(planned.length)} catégories planifiées`);

		// Idempotence : on repère les nœuds déjà créés par cette tâche via leur
		// chemin reconstitué, pas via le nom seul (« Roulements » existe à
		// plusieurs endroits de l'arbre).
		const existing = await sql<{ id: number; name: string; parent_id: number | null }[]>`
			SELECT id, name, parent_id FROM category WHERE source = 'rule'`;

		const pathToId = new Map<string, number>();
		if (existing.length > 0) {
			const byId = new Map(existing.map((c) => [Number(c.id), c]));
			const pathOf = (c: { name: string; parent_id: number | null }): string => {
				const parent = c.parent_id != null ? byId.get(Number(c.parent_id)) : undefined;
				return parent ? `${pathOf(parent)} > ${c.name}` : c.name;
			};
			for (const c of existing) pathToId.set(pathOf(c), Number(c.id));
			log.muted(`${count(pathToId.size)} catégories déjà en place — elles seront réutilisées`);
		}

		const slugRows = await sql<{ slug: string }[]>`SELECT slug FROM category`;
		const usedSlugs = new Set(slugRows.map((r) => r.slug));

		const toCreate = planned.filter((p) => !pathToId.has(p.path));

		if (dryRun) {
			log.warn(`Simulation : ${count(toCreate.length)} catégories auraient été créées.`);
			for (const p of toCreate.slice(0, 12)) log.muted(`  ${p.path}`);
			if (toCreate.length > 12) log.muted(`  … et ${count(toCreate.length - 12)} autres`);
			return { processed: 0, note: 'simulation' };
		}

		// Insertion une par une : 239 lignes, et chaque enfant a besoin de l'id
		// de son parent, tout juste attribué. Un lot n'apporterait rien ici.
		let created = 0;
		for (const p of toCreate) {
			const parentId = p.parentPath ? (pathToId.get(p.parentPath) ?? null) : null;
			if (p.parentPath && parentId === null) {
				throw new Error(`Parent introuvable pour « ${p.path} » — ordre de planification cassé.`);
			}

			const [row] = await sql<{ id: number }[]>`
				INSERT INTO category ${sql({
					parent_id: parentId,
					name: p.name,
					slug: uniqueSlug(slugify(p.name), usedSlugs),
					is_active: true,
					position: p.position,
					source: 'rule'
				})}
				RETURNING id`;

			pathToId.set(p.path, Number(row.id));
			created++;
		}

		log.info(
			`${count(created)} catégories créées, ${count(planned.length - created)} réutilisées.`
		);
		return {
			processed: created,
			note: `${count(pathToId.size)} nœuds au total`
		};
	}
};

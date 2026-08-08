/**
 * Extraction de l'axe **compatibilité machine** — §4.1 règle n°2 du cahier des charges.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Ce que cette tâche récupère, et pourquoi elle est indispensable
 *
 *  Dans PrestaShop, la compatibilité n'est pas une donnée : c'est un **chemin
 *  dans l'arbre des catégories**.
 *
 *      Pièces détachées > BRIGGS STRATTON > TONDEUSES > 46CM > THERMIQUES > …
 *      └── racine 139     └── MARQUE        └── type    └── modèle
 *
 *  C'est la cause directe des 5 948 catégories sur 12 niveaux dont 93 % vides :
 *  chaque modèle y duplique les mêmes nœuds (`Plateau de coupe` ×34).
 *
 *  Les tâches `taxonomy` / `product-taxonomy` **écartent** cette branche de
 *  l'arbre de navigation — à raison. Mais sans cette tâche-ci, l'information
 *  serait purement et simplement **perdue** : c'est elle qui la transforme en
 *  relation N-N exploitable, et donc qui alimente le sélecteur « Ma machine »,
 *  décrit au §4.1 comme le principal levier de conversion du métier.
 *
 *  Une courroie compatible avec 12 modèles = 1 produit + 12 liaisons,
 *  au lieu de 12 catégories.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Ce que la tâche ne fait PAS ────────────────────────────────────────────
 *
 *  Elle n'invente aucune compatibilité. Elle ne reprend que ce qui est
 *  explicitement encodé dans l'arbre source, et pose `source = 'legacy'` sur
 *  chaque liaison — ce qui permettra plus tard de distinguer le déduit du
 *  validé humainement, et de rejouer l'extraction sans écraser le manuel.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { slugify, uniqueSlug } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

/** Langue française dans PrestaShop. */
const ID_LANG = 1;

/**
 * Racine de la branche portant la compatibilité (« Pièces détachées »).
 * Mesurée au §3.4 : 3 483 catégories, 855 443 produits.
 */
const PIECES_BRANCH_ID = 139;

/**
 * Profondeur (`level_depth`) du niveau qui porte les **marques de machines**.
 *
 * Mesuré le 2026-08-07 (§8, « Compatibilité confirmée dans l'arbre ») : le
 * niveau 3 sous « Pièces détachées » est constitué de marques d'engins —
 * BRIGGS STRATTON (13 189 produits), ISEKI (520), HUSQVARNA (179).
 */
const BRAND_DEPTH = 3;

/** Lot d'insertion des liaisons. */
const WRITE_BATCH = 5000;

interface SourceNode {
	id_category: number;
	id_parent: number;
	level_depth: number;
	name: string | null;
	nleft: number;
	nright: number;
}

/**
 * Extrait une plage d'années d'un libellé de catégorie.
 *
 * La source encode les années dans le nom des nœuds, sous des formes variées :
 * `2003`, `2003-2008`, `DE 2003 A 2008`, `>2010`. On ne retient que les
 * millésimes plausibles (1950-2100) pour éviter de confondre avec une
 * cylindrée (`46CM`) ou une référence.
 */
export function parseYears(name: string): { from: number | null; to: number | null } {
	const years = [...(name ?? '').matchAll(/\b(19[5-9]\d|20\d\d)\b/g)]
		.map((m) => Number(m[1]))
		.filter((y) => y >= 1950 && y <= 2100);

	if (years.length === 0) return { from: null, to: null };
	return { from: Math.min(...years), to: years.length > 1 ? Math.max(...years) : null };
}

/**
 * Un nœud est-il un porteur de modèle exploitable ?
 *
 * On écarte les nœuds purement structurels — `Options`, `Divers`, `Autres`,
 * `Accessoires` — qui se répètent sous chaque marque sans désigner un engin.
 * Les ranger comme modèles produirait des milliers de faux « modèles ».
 */
const STRUCTURAL_NODES = new Set([
	'OPTIONS',
	'OPTION',
	'DIVERS',
	'AUTRES',
	'AUTRE',
	'ACCESSOIRES',
	'ACCESSOIRE',
	'PIECES DETACHEES',
	'PIECES',
	'GENERAL',
	'COMMUN'
]);

export function isStructural(name: string): boolean {
	const normalized = (name ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toUpperCase()
		.trim();
	return STRUCTURAL_NODES.has(normalized);
}

export const compatibilityTask: Task = {
	name: 'compatibility',
	description: 'Extrait la compatibilité machine de l’arbre source (marque > modèle)',
	dependsOn: ['products'],

	async run({ dryRun }) {
		const sql = targetDb();

		// --- Lecture de la branche compatibilité ---
		const nodes = await sourceQuery<SourceNode>(
			`SELECT c.id_category, c.id_parent, c.level_depth, c.nleft, c.nright, cl.name
			   FROM ps_category c
			   JOIN ps_category_lang cl
			     ON cl.id_category = c.id_category AND cl.id_lang = ${ID_LANG}
			  WHERE EXISTS (
			        SELECT 1 FROM ps_category root
			         WHERE root.id_category = ${PIECES_BRANCH_ID}
			           AND c.nleft > root.nleft AND c.nright < root.nright
			  )
			  ORDER BY c.nleft`
		);
		log.muted(`${count(nodes.length)} nœuds lus sous « Pièces détachées »`);

		const brands = nodes.filter(
			(n) => Number(n.level_depth) === BRAND_DEPTH && (n.name ?? '').trim() !== ''
		);
		log.info(`${count(brands.length)} marques de machines détectées (niveau ${BRAND_DEPTH})`);

		// --- Modèles : toute la descendance d'une marque, hors nœuds structurels ---
		const byId = new Map(nodes.map((n) => [Number(n.id_category), n]));
		/** modèle → marque porteuse. */
		const modelsByBrand = new Map<number, SourceNode[]>();

		for (const node of nodes) {
			const depth = Number(node.level_depth);
			if (depth <= BRAND_DEPTH) continue;
			if (isStructural(node.name ?? '')) continue;

			// Remonte jusqu'au nœud de niveau `BRAND_DEPTH` : c'est la marque.
			let cursor: SourceNode | undefined = node;
			while (cursor && Number(cursor.level_depth) > BRAND_DEPTH) {
				cursor = byId.get(Number(cursor.id_parent));
			}
			if (!cursor || Number(cursor.level_depth) !== BRAND_DEPTH) continue;

			const brandId = Number(cursor.id_category);
			const list = modelsByBrand.get(brandId);
			if (list) list.push(node);
			else modelsByBrand.set(brandId, [node]);
		}

		const modelCount = [...modelsByBrand.values()].reduce((sum, l) => sum + l.length, 0);
		log.info(`${count(modelCount)} nœuds-modèles rattachés à une marque`);

		if (dryRun) {
			log.warn('Simulation — aucune écriture. Aperçu :');
			for (const brand of brands.slice(0, 10)) {
				const models = modelsByBrand.get(Number(brand.id_category)) ?? [];
				log.muted(`  ${(brand.name ?? '').padEnd(28)} ${count(models.length)} modèles`);
				for (const m of models.slice(0, 3)) {
					const { from, to } = parseYears(m.name ?? '');
					const years = from ? ` [${from}${to ? `-${to}` : '+'}]` : '';
					log.muted(`      ${m.name}${years}`);
				}
			}
			if (brands.length > 10) log.muted(`  … et ${count(brands.length - 10)} autres marques`);
			return { processed: 0, note: 'simulation' };
		}

		// --- Écriture des marques de machines ---
		const existingBrands = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM machine_brand WHERE legacy_ps_id IS NOT NULL`;
		const brandIdByLegacy = new Map(
			existingBrands.map((b) => [Number(b.legacy_ps_id), Number(b.id)])
		);

		const brandSlugRows = await sql<{ slug: string }[]>`SELECT slug FROM machine_brand`;
		const usedBrandSlugs = new Set(brandSlugRows.map((r) => r.slug));

		let brandsCreated = 0;
		for (const brand of brands) {
			const legacyId = Number(brand.id_category);
			if (brandIdByLegacy.has(legacyId)) continue;

			const name = (brand.name ?? '').trim();
			const [row] = await sql<{ id: number }[]>`
				INSERT INTO machine_brand ${sql({
					name,
					slug: uniqueSlug(slugify(name), usedBrandSlugs),
					is_active: true,
					legacy_ps_id: legacyId
				})}
				RETURNING id`;

			brandIdByLegacy.set(legacyId, Number(row.id));
			brandsCreated++;
		}
		log.info(`${count(brandsCreated)} marques de machines créées.`);

		// --- Écriture des modèles ---
		const existingModels = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM machine_model WHERE legacy_ps_id IS NOT NULL`;
		const modelIdByLegacy = new Map(
			existingModels.map((m) => [Number(m.legacy_ps_id), Number(m.id)])
		);

		// Les slugs de modèles ne sont uniques que **par marque** : deux
		// constructeurs peuvent nommer un modèle pareil (index composite).
		const modelSlugRows = await sql<{ brand_id: number; slug: string }[]>`
			SELECT brand_id, slug FROM machine_model`;
		const slugsByBrand = new Map<number, Set<string>>();
		for (const r of modelSlugRows) {
			const set = slugsByBrand.get(Number(r.brand_id));
			if (set) set.add(r.slug);
			else slugsByBrand.set(Number(r.brand_id), new Set([r.slug]));
		}

		let modelsCreated = 0;
		for (const [legacyBrandId, models] of modelsByBrand) {
			const brandId = brandIdByLegacy.get(legacyBrandId);
			if (brandId === undefined) continue;

			let slugs = slugsByBrand.get(brandId);
			if (!slugs) {
				slugs = new Set<string>();
				slugsByBrand.set(brandId, slugs);
			}

			for (const model of models) {
				const legacyId = Number(model.id_category);
				if (modelIdByLegacy.has(legacyId)) continue;

				const name = (model.name ?? '').trim();
				const { from, to } = parseYears(name);

				const [row] = await sql<{ id: number }[]>`
					INSERT INTO machine_model ${sql({
						brand_id: brandId,
						name,
						slug: uniqueSlug(slugify(name), slugs),
						year_from: from,
						year_to: to,
						is_active: true,
						legacy_ps_id: legacyId
					})}
					RETURNING id`;

				modelIdByLegacy.set(legacyId, Number(row.id));
				modelsCreated++;
			}
		}
		log.info(`${count(modelsCreated)} modèles de machines créés.`);

		// --- Liaisons pièce ↔ modèle ---
		// Un produit rattaché (à la source) à un nœud-modèle, ou à l'un de ses
		// descendants, est compatible avec ce modèle. On passe par une table
		// temporaire : la résolution `legacy → id` se fait par jointure indexée
		// côté Postgres, comme pour les autres tâches volumineuses.
		log.step('Extraction des liaisons de compatibilité…');

		const modelLegacyIds = [...modelIdByLegacy.keys()];
		let linked = 0;

		if (modelLegacyIds.length === 0) {
			log.warn('Aucun modèle : aucune liaison à extraire.');
			return { processed: 0, note: 'aucun modèle' };
		}

		// Liaisons produits ↔ nœuds-modèles, lues côté source.
		const links = await sourceQuery<{ id_product: number; id_category: number }>(
			`SELECT DISTINCT cp.id_product, cp.id_category
			   FROM ps_category_product cp
			  WHERE cp.id_category IN (${modelLegacyIds.join(',')})`
		);
		log.muted(`${count(links.length)} liaisons produit ↔ modèle en source`);

		await sql.begin(async (tx) => {
			await tx`
				CREATE TEMP TABLE tmp_compat (
					legacy_product int NOT NULL,
					model_id       int NOT NULL
				) ON COMMIT DROP`;

			const batch = links
				.map((l) => ({
					legacy_product: Number(l.id_product),
					model_id: modelIdByLegacy.get(Number(l.id_category))
				}))
				.filter((r): r is { legacy_product: number; model_id: number } => r.model_id !== undefined);

			for (let i = 0; i < batch.length; i += WRITE_BATCH) {
				await tx`INSERT INTO tmp_compat ${tx(batch.slice(i, i + WRITE_BATCH))}`;
			}

			await tx`CREATE INDEX ON tmp_compat (legacy_product)`;
			await tx`ANALYZE tmp_compat`;

			const result = await tx`
				INSERT INTO product_compatibility (product_id, model_id, source)
				SELECT DISTINCT p.id, t.model_id, 'legacy'
				  FROM tmp_compat t
				  JOIN product p ON p.legacy_ps_id = t.legacy_product
				ON CONFLICT DO NOTHING`;

			linked = result.count;
		});

		log.success(
			`${count(linked)} compatibilités créées ` +
				`(${count(brandsCreated)} marques, ${count(modelsCreated)} modèles).`
		);

		return {
			processed: linked,
			note: `${count(brandsCreated)} marques, ${count(modelsCreated)} modèles, ${count(linked)} liaisons`
		};
	}
};

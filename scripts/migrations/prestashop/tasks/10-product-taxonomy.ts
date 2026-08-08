/**
 * Reprise de la taxonomie « produits & machines » depuis PrestaShop.
 *
 * Contrairement aux pièces — dont l'arbre est *construit* par règles
 * (`08-taxonomy.ts`) faute de taxonomie exploitable à la source — les branches
 * produits ont déjà une structure métier correcte, mesurée à l'étape 1 :
 * `Motoculture > Tondeuses > Tondeuses tractées`, `> Tracteurs tondeuse >
 * Tracteurs tondeuses à rayon de braquage zéro`… Elle est donc **reprise telle
 * quelle**, pas réinventée.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Ce qui est filtré au passage — les nœuds-marques
 *
 *  Règle n°1 du §4.1 : un nœud portant un nom de marque n'a rien à faire dans
 *  l'arbre. `EGO POWER+` recrée sous lui TONDEUSES, TRONCONNEUSES,
 *  TAILLE-HAIES… qui existent déjà au niveau au-dessus — d'où des doublons.
 *
 *  Ces nœuds sont écartés **avec toute leur descendance** (voir `brand-nodes.ts`).
 *  Écarter le parent seul ferait remonter ses 24 enfants sous « Motoculture »
 *  et recréerait exactement les doublons qu'on veut supprimer.
 *
 *  Leurs produits ne sont pas perdus : ils sont rattachés au parent du nœud
 *  écarté (le vrai type est au-dessus), et gardent leur marque dans
 *  `product.brand_id` — qui reste l'axe de navigation par marque.
 * ────────────────────────────────────────────────────────────────────────────
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { slugify, uniqueSlug, bool } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { PRODUCTS_ROOT } from '../taxonomy.ts';
import { BRAND_NODES, BRAND_NODE_IDS, PIECES_NODE_IDS } from '../brand-nodes.ts';

/** Langue française dans PrestaShop. */
const ID_LANG = 1;

/**
 * Branches de niveau 2 constituant le catalogue « produits ».
 *
 * `Pièces détachées` (139), `KRAMP` (7057) et `Vues éclatées` (3335) en sont
 * volontairement absentes : les deux premières relèvent du tri par règles, la
 * troisième devient des médias.
 */
const PRODUCT_BRANCHES: { legacyPsId: number; label: string }[] = [
	{ legacyPsId: 23, label: 'Motoculture' },
	{ legacyPsId: 230, label: 'Électroportatif' },
	{ legacyPsId: 102, label: 'Consommables' },
	{ legacyPsId: 3724, label: 'Jardin & extérieur' },
	{ legacyPsId: 103, label: 'Vêtements & sécurité (EPI)' },
	{ legacyPsId: 3775, label: 'Équipement cheval' },
	{ legacyPsId: 7247, label: 'Gamme hiver' }
];

interface SourceCategory {
	id_category: number;
	id_parent: number;
	level_depth: number;
	position: number;
	active: number;
	name: string | null;
	total: number;
}

export const productTaxonomyTask: Task = {
	name: 'product-taxonomy',
	description: 'Reprend la taxonomie produits de PrestaShop (hors nœuds-marques)',
	dependsOn: ['taxonomy'],

	async run({ dryRun }) {
		const sql = targetDb();

		// --- Racine « Produits & machines », créée par 08-taxonomy ---
		const [root] = await sql<{ id: number }[]>`
			SELECT id FROM category
			 WHERE source = 'rule' AND parent_id IS NULL AND name = ${PRODUCTS_ROOT}
			 LIMIT 1`;

		if (!root) {
			throw new Error(
				`Racine « ${PRODUCTS_ROOT} » absente : jouer « taxonomy » avant « product-taxonomy ».`
			);
		}

		// --- Lecture de l'arbre source, branche par branche ---
		const branchIds = PRODUCT_BRANCHES.map((b) => b.legacyPsId).join(',');
		const rows = await sourceQuery<SourceCategory>(
			`SELECT c.id_category, c.id_parent, c.level_depth, c.position, c.active,
			        cl.name,
			        (SELECT COUNT(DISTINCT cp.id_product)
			           FROM ps_category_product cp
			           JOIN ps_category c2 ON c2.id_category = cp.id_category
			          WHERE c2.nleft >= c.nleft AND c2.nright <= c.nright) AS total
			   FROM ps_category c
			   JOIN ps_category_lang cl
			     ON cl.id_category = c.id_category AND cl.id_lang = ${ID_LANG}
			  WHERE EXISTS (
			        SELECT 1 FROM ps_category root
			         WHERE root.id_category IN (${branchIds})
			           AND c.nleft >= root.nleft AND c.nright <= root.nright
			  )
			  ORDER BY c.nleft`
		);
		log.muted(`${count(rows.length)} catégories lues dans les branches produits`);

		// --- Exclusion des nœuds-marques et de toute leur descendance ---
		const byId = new Map(rows.map((r) => [Number(r.id_category), r]));
		const excluded = new Set<number>();

		for (const row of rows) {
			// Un nœud est écarté s'il est lui-même un nœud-marque, ou si l'un de
			// ses ancêtres l'est. Le parcours remonte la chaîne : les branches
			// sont peu profondes (5 niveaux), le coût est négligeable.
			let cursor: SourceCategory | undefined = row;
			while (cursor) {
				if (BRAND_NODE_IDS.has(Number(cursor.id_category))) {
					excluded.add(Number(row.id_category));
					break;
				}
				cursor = byId.get(Number(cursor.id_parent));
			}
		}

		log.info(`${count(BRAND_NODES.length)} nœuds-marques écartés, avec leur descendance :`);
		for (const node of BRAND_NODES.filter((n) => n.products > 0)) {
			log.muted(`  ${String(node.products).padStart(6)}  ${node.name} — ${node.reason}`);
		}
		log.muted(`  soit ${count(excluded.size)} nœuds au total retirés de l'arbre`);

		// Les nœuds vides ne sont pas repris : le §7 contrôle n°4 exige zéro
		// catégorie vide visible, et la source en compte 93 %.
		const kept = rows.filter(
			(r) => !excluded.has(Number(r.id_category)) && Number(r.total) > 0
		);
		log.muted(`${count(kept.length)} catégories retenues (non vides, hors marques)`);

		// --- Idempotence ---
		const existing = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM category
			 WHERE source = 'legacy' AND legacy_ps_id IS NOT NULL`;
		const idByLegacy = new Map(existing.map((c) => [Number(c.legacy_ps_id), Number(c.id)]));
		if (idByLegacy.size > 0) {
			log.muted(`${count(idByLegacy.size)} catégories produits déjà reprises`);
		}

		const branchRootIds = new Set(PRODUCT_BRANCHES.map((b) => b.legacyPsId));
		const toCreate = kept.filter((r) => !idByLegacy.has(Number(r.id_category)));

		if (dryRun) {
			log.warn(`Simulation : ${count(toCreate.length)} catégories auraient été créées.`);
			for (const r of toCreate.slice(0, 12)) {
				log.muted(`  ${'  '.repeat(Math.max(0, Number(r.level_depth) - 2))}${r.name} (${r.total})`);
			}
			if (toCreate.length > 12) log.muted(`  … et ${count(toCreate.length - 12)} autres`);
			return { processed: 0, note: 'simulation' };
		}

		const slugRows = await sql<{ slug: string }[]>`SELECT slug FROM category`;
		const usedSlugs = new Set(slugRows.map((r) => r.slug));

		// `rows` est trié par `nleft` : un parent précède toujours ses enfants,
		// donc son id cible est connu au moment d'insérer l'enfant.
		let created = 0;
		let reattached = 0;

		for (const r of toCreate) {
			const legacyId = Number(r.id_category);
			const legacyParent = Number(r.id_parent);

			// Une branche de niveau 2 se rattache à la racine « Produits ».
			// Sinon on suit le parent source — sauf s'il a été écarté, auquel cas
			// on remonte jusqu'au premier ancêtre conservé.
			let parentId: number;
			if (branchRootIds.has(legacyId)) {
				parentId = Number(root.id);
			} else {
				let ancestor: SourceCategory | undefined = byId.get(legacyParent);
				while (ancestor && excluded.has(Number(ancestor.id_category))) {
					ancestor = byId.get(Number(ancestor.id_parent));
					reattached++;
				}
				const resolved = ancestor ? idByLegacy.get(Number(ancestor.id_category)) : undefined;
				parentId = resolved ?? Number(root.id);
			}

			const name = (r.name ?? '').trim() || `Catégorie ${legacyId}`;
			const [inserted] = await sql<{ id: number }[]>`
				INSERT INTO category ${sql({
					parent_id: parentId,
					name,
					slug: uniqueSlug(slugify(name), usedSlugs),
					is_active: bool(r.active),
					position: Number(r.position) || 0,
					source: 'legacy',
					legacy_ps_id: legacyId
				})}
				RETURNING id`;

			idByLegacy.set(legacyId, Number(inserted.id));
			created++;
		}

		log.info(`${count(created)} catégories produits créées.`);
		if (reattached > 0) {
			log.muted(`${count(reattached)} rattachements remontés au-dessus d'un nœud-marque`);
		}

		// --- Rattachement des produits finis à leur catégorie ---
		// Les produits portent `legacy_category_ps_id` (l'`id_category_default`
		// source). On le résout ici vers l'arbre **propre**, en redirigeant les
		// nœuds-marques écartés vers le premier ancêtre conservé : un produit
		// rangé sous « EGO POWER+ > TONDEUSES » atterrit sous « Tondeuses ».
		const redirect = new Map<number, number>();
		for (const r of rows) {
			const legacyId = Number(r.id_category);
			if (!excluded.has(legacyId)) continue;

			let ancestor: SourceCategory | undefined = byId.get(Number(r.id_parent));
			while (ancestor && excluded.has(Number(ancestor.id_category))) {
				ancestor = byId.get(Number(ancestor.id_parent));
			}
			const targetId = ancestor ? idByLegacy.get(Number(ancestor.id_category)) : undefined;
			if (targetId !== undefined) redirect.set(legacyId, targetId);
		}

		// Table de correspondance complète : nœuds conservés + nœuds redirigés.
		const mapping: { legacy: number; target: number }[] = [];
		for (const r of kept) {
			const id = idByLegacy.get(Number(r.id_category));
			if (id !== undefined) mapping.push({ legacy: Number(r.id_category), target: id });
		}
		for (const [legacy, target] of redirect) mapping.push({ legacy, target });

		let placed = 0;
		await sql.begin(async (tx) => {
			await tx`
				CREATE TEMP TABLE tmp_product_taxonomy (
					legacy int NOT NULL,
					target int NOT NULL
				) ON COMMIT DROP`;

			for (let i = 0; i < mapping.length; i += 2000) {
				await tx`INSERT INTO tmp_product_taxonomy ${tx(mapping.slice(i, i + 2000))}`;
			}
			await tx`CREATE INDEX ON tmp_product_taxonomy (legacy)`;
			await tx`ANALYZE tmp_product_taxonomy`;

			// Catégorie principale : porte l'URL canonique et le fil d'Ariane.
			const result = await tx`
				UPDATE product p
				   SET category_id = t.target
				  FROM tmp_product_taxonomy t
				 WHERE p.legacy_category_ps_id = t.legacy
				   AND p.category_id IS DISTINCT FROM t.target`;
			placed = result.count;

			// Rangement N-N : c'est lui que lit la navigation (§4.1 règle n°4),
			// et c'est ce que `reclassify` relit pour épargner ces produits.
			await tx`
				INSERT INTO product_category (product_id, category_id)
				SELECT p.id, t.target
				  FROM product p
				  JOIN tmp_product_taxonomy t ON t.legacy = p.legacy_category_ps_id
				ON CONFLICT DO NOTHING`;
		});

		log.success(`${count(placed)} produits finis rangés dans la taxonomie métier.`);

		return {
			processed: created,
			note: `${count(excluded.size)} nœuds-marques écartés, ${count(placed)} produits rangés`
		};
	}
};

/**
 * Import des produits : `ps_product` + `ps_product_lang` → `product`.
 *
 * C'est la tâche qui corrige le **constat n°1** du cahier des charges : l'ancienne
 * migration passait par `metro` et faisait un double mapping
 * (`categorie_id` → `categories.id` → `id_category` → `legacy_ps_id`) dont tout
 * maillon manquant produisait un `category_id = null` silencieux — d'où 81 % de
 * produits orphelins en cible pour 99,999 % de produits catégorisés en source.
 *
 * Ici le mapping est **direct** : `ps_product.id_category_default` → `category.legacy_ps_id`.
 * Un seul saut, et tout produit dont la catégorie n'est pas résolue est **compté
 * et rapporté**, jamais perdu en silence.
 *
 * Volume : ~1,05 M de produits. L'import est donc :
 *  - lu **par curseur** sur la source (pagination par clé, jamais `OFFSET`) ;
 *  - écrit **par lots** en cible ;
 *  - **idempotent** via `legacy_ps_id` — relançable après interruption.
 *
 * Les catégories additionnelles (`ps_category_product`, 1,06 M de liaisons) sont
 * traitées par la tâche suivante (`04-product-categories`), une fois tous les
 * produits présents en cible.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery, sourceCursor } from '../source-db.ts';
import { insertBatched, targetDb } from '../../../lib/target-db.ts';
import { slugify, money, bool, text, date, truncate } from '../../../lib/transform.ts';
import { log, count, progress } from '../../../lib/logger.ts';

/** Langue française dans PrestaShop. */
const ID_LANG = 1;

/**
 * Bornes nested-set du silo KRAMP (`id_category` 7057), mesurées le 2026-08-08
 * en lecture seule sur `prod5` : 480 catégories, 169 006 produits.
 *
 * Le nœud n'est pas repris dans l'arbre (c'est une marque), mais son libellé
 * sert de signal de classement — voir `kramp-mapping.ts`.
 */
const KRAMP_NLEFT = 10911;
const KRAMP_NRIGHT = 11872;

/** Taille de page de lecture source. Compromis mémoire / aller-retours réseau. */
const PAGE_SIZE = 5000;

// `sourceCursor` exige une index signature (contrainte
// `Record<string, unknown>`) : les lignes MySQL sont indexées par nom
// de colonne.
interface SourceProduct {
	[key: string]: unknown;
	id_product: number;
	id_manufacturer: number | null;
	id_category_default: number | null;
	id_supplier: number | null;
	reference: string | null;
	supplier_reference: string | null;
	ean13: string | null;
	price: string | null;
	wholesale_price: string | null;
	weight: string | null;
	width: string | null;
	height: string | null;
	depth: string | null;
	additional_shipping_cost: string | null;
	active: number;
	quantity: number | null;
	date_add: Date | null;
	date_upd: Date | null;
	name: string | null;
	description: string | null;
	description_short: string | null;
	link_rewrite: string | null;
	meta_title: string | null;
	meta_description: string | null;
}

export const productsTask: Task = {
	name: 'products',
	description: 'Produits (ps_product → product)',
	// Plus de dépendance à `categories` : l'arbre source n'est plus importé
	// verbatim. La catégorie principale est attribuée plus tard, par
	// `product-taxonomy` (produits finis) puis `reclassify` (pièces), sur
	// l'arbre propre. Voir l'ordre des tâches dans `index.ts`.
	dependsOn: ['brands'],

	async run({ dryRun, limit }) {
		const sql = targetDb();

		// --- Mappings legacy → id cible, chargés une fois en mémoire ---
		// 1 117 marques : négligeable en mémoire, et cela évite une requête par
		// produit sur 1,05 M de lignes.
		const brandRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM brand WHERE legacy_ps_id IS NOT NULL`;
		const brandByLegacy = new Map(brandRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

		// Chemin fournisseur KRAMP, chargé une fois : c'est un signal de
		// classement plus fiable que le premier mot pour ~30 000 produits, et le
		// silo KRAMP n'étant pas repris dans l'arbre, l'information serait
		// autrement perdue (§6.9). ~169 000 entrées : négligeable en mémoire.
		const krampRows = await sourceQuery<{ id_product: number; chemin: string }>(
			`SELECT DISTINCT cp.id_product,
			        CONCAT(COALESCE(p4.name,''), ' > ', COALESCE(cl.name,'')) AS chemin
			   FROM ps_category c
			   JOIN ps_category_product cp ON cp.id_category = c.id_category
			   JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = ${ID_LANG}
			   JOIN ps_category cc ON cc.id_category = c.id_category
			   LEFT JOIN ps_category_lang p4 ON p4.id_category = cc.id_parent AND p4.id_lang = ${ID_LANG}
			  WHERE c.nleft > ${KRAMP_NLEFT} AND c.nright < ${KRAMP_NRIGHT}`
		);
		const krampPathByProduct = new Map<number, string>();
		for (const r of krampRows) {
			// Un produit peut apparaître sous plusieurs feuilles KRAMP : on garde
			// la première, le mapping les traite de façon équivalente.
			if (!krampPathByProduct.has(Number(r.id_product))) {
				krampPathByProduct.set(Number(r.id_product), r.chemin);
			}
		}

		// La catégorie principale n'est PAS résolue ici : l'arbre propre
		// (`taxonomy` / `product-taxonomy`) n'existe pas encore à ce stade. On
		// conserve `id_category_default` tel quel dans `legacy_category_ps_id`,
		// et ce sont les tâches de taxonomie qui attribueront `category_id`.
		log.muted(
			`${count(brandByLegacy.size)} marques mappées, ` +
				`${count(krampPathByProduct.size)} chemins fournisseur KRAMP — ` +
				'catégorie principale attribuée plus tard'
		);

		// Note : plus aucun garde-fou « catégories absentes » ici. Il exigeait que
		// la tâche `categories` ait tourné, or elle est sortie du pipeline (§6.6) :
		// l'arbre source n'est plus importé verbatim, et la catégorie principale
		// est attribuée plus tard par `product-taxonomy` / `reclassify`.

		// --- Idempotence : legacy_ps_id déjà présents en cible ---
		// Un Set de 1,05 M d'entiers ≈ 60 Mo — acceptable, et bien moins coûteux
		// qu'un aller-retour SQL par lot pour savoir ce qui existe déjà.
		const importedRows = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM product WHERE legacy_ps_id IS NOT NULL`;
		const alreadyImported = new Set(importedRows.map((r) => Number(r.legacy_ps_id)));
		if (alreadyImported.size > 0) {
			log.muted(`${count(alreadyImported.size)} produits déjà importés — ils seront ignorés`);
		}

		const [{ total }] = await sourceQuery<{ total: number }>(
			'SELECT COUNT(*) AS total FROM ps_product'
		);
		const expected = limit ?? Number(total);
		log.muted(
			`${count(Number(total))} produits en source${limit ? ` (limite : ${count(limit)})` : ''}`
		);

		// La source contient des slugs et références en doublon (~247k) : les index
		// cible sont volontairement non-uniques (voir catalog.schema.ts). On ne
		// déduplique donc pas les slugs ici — ce serait 1 M d'entrées en mémoire
		// pour un index qui n'impose pas l'unicité.

		const bar = progress('produits', expected);
		let read = 0;
		let inserted = 0;
		let withoutCategory = 0;
		let withoutBrand = 0;

		const select = `
			SELECT p.id_product, p.id_manufacturer, p.id_category_default, p.id_supplier,
			       p.reference, p.supplier_reference, p.ean13,
			       p.price, p.wholesale_price, p.weight, p.width, p.height, p.depth,
			       p.additional_shipping_cost, p.active, p.quantity,
			       p.date_add, p.date_upd,
			       pl.name, pl.description, pl.description_short, pl.link_rewrite,
			       pl.meta_title, pl.meta_description
			  FROM ps_product p
			  LEFT JOIN ps_product_lang pl
			         ON pl.id_product = p.id_product AND pl.id_lang = ${ID_LANG}
			 WHERE 1 = 1 {{WHERE}}`;

		// La page est bornée par `--limit` : sinon `--limit=1000` lirait et
		// importerait une page entière de 20 000 produits, alors que c'est la
		// commande d'essai prudent avant la migration complète.
		const pageSize = limit === null ? PAGE_SIZE : Math.min(PAGE_SIZE, limit);

		for await (const rows of sourceCursor<SourceProduct>(select, 'p.id_product', pageSize)) {
			const batch: Record<string, unknown>[] = [];

			for (const r of rows) {
				const legacyId = Number(r.id_product);
				if (alreadyImported.has(legacyId)) continue;

				// Catégorie source conservée telle quelle : elle sera résolue sur
				// l'arbre propre par `product-taxonomy` / `reclassify`.
				const legacyCategoryId = r.id_category_default
					? Number(r.id_category_default)
					: null;
				if (legacyCategoryId === null) withoutCategory++;

				const brandId = r.id_manufacturer
					? (brandByLegacy.get(Number(r.id_manufacturer)) ?? null)
					: null;
				if (brandId === null) withoutBrand++;

				const name = text(r.name) ?? `Produit ${legacyId}`;

				batch.push({
					name,
					// `reference` est NOT NULL en cible : repli traçable sur l'id source.
					reference: text(r.reference) ?? `PS-${legacyId}`,
					supplier_reference: text(r.supplier_reference),
					// ean13 est un varchar(13) : la source contient des valeurs plus longues.
					ean13: truncate(r.ean13, 13),
					brand_id: brandId,
					// `category_id` reste null à l'import : attribué par les tâches
					// de taxonomie, sur l'arbre propre.
					category_id: null,
					legacy_category_ps_id: legacyCategoryId,
					supplier_category_path: krampPathByProduct.get(legacyId) ?? null,
					slug: slugify(r.link_rewrite || name) || `produit-${legacyId}`,
					short_description: text(r.description_short),
					description: text(r.description),
					meta_title: text(r.meta_title),
					meta_description: text(r.meta_description),
					price_ht: money(r.price, '0'),
					purchase_price: money(r.wholesale_price, null),
					stock: Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0,
					weight_kg: money(r.weight, null),
					// PrestaShop : depth = profondeur, mappée sur length_cm en cible.
					length_cm: money(r.depth, null),
					width_cm: money(r.width, null),
					height_cm: money(r.height, null),
					shipping_extra_fee: money(r.additional_shipping_cost, null),
					supplier_id: r.id_supplier ? Number(r.id_supplier) : null,
					is_active: bool(r.active),
					legacy_ps_id: legacyId,
					created_at: date(r.date_add),
					updated_at: date(r.date_upd)
				});
			}

			if (!dryRun && batch.length > 0) {
				inserted += await insertBatched('product', batch);
			}

			read += rows.length;
			bar.tick(read);
			if (limit !== null && read >= limit) break;
		}

		bar.done(dryRun ? read : inserted);

		if (dryRun) {
			log.warn(`Simulation : ${count(read)} produits lus, aucune écriture.`);
		}

		// `withoutBrand` est l'indicateur de recette n°7 (§7), mesurable dès ici.
		// `withoutCategory` compte les produits **sans catégorie à la source**
		// (13 attendus sur 1 053 957) : ce n'est PAS le contrôle n°2, qui porte
		// sur le rangement final et ne se mesure qu'après `reclassify`.
		const pct = (n: number) => (read > 0 ? ((n / read) * 100).toFixed(2) : '0');
		log.info(
			`sans catégorie source : ${count(withoutCategory)} (${pct(withoutCategory)} %) — attendu ≈ 13`
		);
		log.info(`sans marque           : ${count(withoutBrand)} (${pct(withoutBrand)} %) — cible < 1 %`);

		return {
			processed: dryRun ? 0 : inserted,
			note: dryRun
				? 'simulation'
				: `${count(withoutCategory)} sans catégorie source, ${count(withoutBrand)} sans marque`
		};
	}
};

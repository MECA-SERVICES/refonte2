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

/** Taille de page de lecture source. Compromis mémoire / aller-retours réseau. */
const PAGE_SIZE = 5000;

interface SourceProduct {
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
	dependsOn: ['brands', 'categories'],

	async run({ dryRun, limit }) {
		const sql = targetDb();

		// --- Mappings legacy → id cible, chargés une fois en mémoire ---
		// 1 117 marques et ~5 950 catégories : négligeable en mémoire, et cela
		// évite une requête par produit sur 1,05 M de lignes.
		const brandRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM brand WHERE legacy_ps_id IS NOT NULL`;
		const brandByLegacy = new Map(brandRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

		const categoryRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM category WHERE legacy_ps_id IS NOT NULL`;
		const categoryByLegacy = new Map(
			categoryRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)])
		);

		log.muted(
			`${count(brandByLegacy.size)} marques et ${count(categoryByLegacy.size)} catégories mappées`
		);

		if (categoryByLegacy.size === 0) {
			throw new Error(
				'Aucune catégorie en cible : jouer la tâche « categories » avant « products ».'
			);
		}

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

		for await (const rows of sourceCursor<SourceProduct>(select, 'p.id_product', PAGE_SIZE)) {
			const batch: Record<string, unknown>[] = [];

			for (const r of rows) {
				const legacyId = Number(r.id_product);
				if (alreadyImported.has(legacyId)) continue;

				const categoryId = r.id_category_default
					? (categoryByLegacy.get(Number(r.id_category_default)) ?? null)
					: null;
				if (categoryId === null) withoutCategory++;

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
					category_id: categoryId,
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

		// Ces deux compteurs sont les indicateurs de recette n°2 et n°7 (§7).
		// Ils doivent être lus à chaque exécution, pas seulement en cas d'échec.
		const pct = (n: number) => (read > 0 ? ((n / read) * 100).toFixed(2) : '0');
		log.info(
			`sans catégorie : ${count(withoutCategory)} (${pct(withoutCategory)} %) — cible < 1 %`
		);
		log.info(`sans marque    : ${count(withoutBrand)} (${pct(withoutBrand)} %) — cible < 1 %`);

		return {
			processed: dryRun ? 0 : inserted,
			note: dryRun
				? 'simulation'
				: `${count(withoutCategory)} sans catégorie, ${count(withoutBrand)} sans marque`
		};
	}
};

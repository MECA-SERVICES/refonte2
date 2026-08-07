/**
 * Import des déclinaisons : `ps_product_attribute` → `product_variant`.
 *
 * Seulement 1 318 déclinaisons en source : contrairement aux produits et aux
 * images, le volume autorise une résolution simple en mémoire, sans table
 * temporaire. Inutile de payer la complexité pour 1 300 lignes.
 *
 * Les attributs PrestaShop sont normalisés sur trois tables
 * (`ps_product_attribute_combination` → `ps_attribute` → `ps_attribute_lang`,
 * plus le groupe pour le libellé). En cible, `product_variant.attributes` est un
 * `jsonb` libre du type `{"Pointure": "39", "Couleur": "Noir"}` : on aplatit
 * donc la combinaison en un objet groupe → valeur.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { insertBatched, targetDb } from '../../../lib/target-db.ts';
import { money, bool, text, truncate } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

/** Langue française dans PrestaShop. */
const ID_LANG = 1;

interface SourceVariant {
	id_product_attribute: number;
	id_product: number;
	reference: string | null;
	ean13: string | null;
	price: string | null;
	weight: string | null;
	quantity: number | null;
	default_on: number | null;
}

interface SourceCombination {
	id_product_attribute: number;
	group_name: string | null;
	value_name: string | null;
}

export const variantsTask: Task = {
	name: 'variants',
	description: 'Déclinaisons (ps_product_attribute → product_variant)',
	dependsOn: ['products'],

	async run({ dryRun }) {
		const sql = targetDb();

		const rows = await sourceQuery<SourceVariant>(
			`SELECT id_product_attribute, id_product, reference, ean13,
			        price, weight, quantity, default_on
			   FROM ps_product_attribute
			  ORDER BY id_product_attribute`
		);
		log.muted(`${count(rows.length)} déclinaisons en source`);

		if (rows.length === 0) return { processed: 0 };

		// --- Attributs de chaque combinaison, aplatis en { groupe: valeur } ---
		const combinations = await sourceQuery<SourceCombination>(
			`SELECT pac.id_product_attribute,
			        agl.name AS group_name,
			        al.name  AS value_name
			   FROM ps_product_attribute_combination pac
			   JOIN ps_attribute a           ON a.id_attribute = pac.id_attribute
			   LEFT JOIN ps_attribute_lang al
			          ON al.id_attribute = a.id_attribute AND al.id_lang = ${ID_LANG}
			   LEFT JOIN ps_attribute_group_lang agl
			          ON agl.id_attribute_group = a.id_attribute_group AND agl.id_lang = ${ID_LANG}`
		);

		const attributesByVariant = new Map<number, Record<string, string>>();
		for (const c of combinations) {
			const group = text(c.group_name) ?? 'Attribut';
			const value = text(c.value_name);
			if (!value) continue;

			const key = Number(c.id_product_attribute);
			const bag = attributesByVariant.get(key) ?? {};
			bag[group] = value;
			attributesByVariant.set(key, bag);
		}
		log.muted(`${count(attributesByVariant.size)} déclinaisons avec attributs nommés`);

		// --- Mappings cible ---
		const legacyProductIds = [...new Set(rows.map((r) => Number(r.id_product)))];
		const productRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM product WHERE legacy_ps_id = ANY(${legacyProductIds})`;
		const productByLegacy = new Map(productRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

		const existing = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM product_variant WHERE legacy_ps_id IS NOT NULL`;
		const alreadyImported = new Set(existing.map((r) => Number(r.legacy_ps_id)));

		let unresolved = 0;
		const toInsert: Record<string, unknown>[] = [];

		for (const r of rows) {
			const legacyId = Number(r.id_product_attribute);
			if (alreadyImported.has(legacyId)) continue;

			const productId = productByLegacy.get(Number(r.id_product));
			if (!productId) {
				unresolved++;
				continue;
			}

			const attributes = attributesByVariant.get(legacyId) ?? {};
			// `name` est NOT NULL : on compose le libellé depuis les attributs
			// (« Couleur : Noir · Pointure : 39 »), avec repli sur la référence.
			const label = Object.entries(attributes)
				.map(([group, value]) => `${group} : ${value}`)
				.join(' · ');

			toInsert.push({
				product_id: productId,
				name: label || text(r.reference) || `Déclinaison ${legacyId}`,
				attributes: Object.keys(attributes).length > 0 ? JSON.stringify(attributes) : null,
				reference: text(r.reference),
				ean13: truncate(r.ean13, 13),
				// PrestaShop stocke un *impact* de prix, pas un prix absolu :
				// la sémantique correspond directement à price_impact en cible.
				price_impact: money(r.price, '0'),
				weight_impact: money(r.weight, '0'),
				stock: Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0,
				is_default: bool(r.default_on),
				legacy_ps_id: legacyId
			});
		}

		if (dryRun) {
			log.warn(`Simulation : ${count(toInsert.length)} déclinaisons auraient été insérées.`);
			return { processed: 0, note: 'simulation' };
		}

		const inserted = await insertBatched('product_variant', toInsert);

		if (unresolved > 0) {
			log.warn(`${count(unresolved)} déclinaisons ignorées — produit parent absent en cible.`);
		}

		return {
			processed: inserted,
			note: unresolved > 0 ? `${count(unresolved)} sans produit parent` : undefined
		};
	}
};

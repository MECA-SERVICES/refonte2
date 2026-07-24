/**
 * Migration des produits (source.products → target.product) + médias.
 *
 * Mappings :
 *  - brand_id    : products.marque_id → marques.id → brand.legacy_ps_id
 *  - category_id : products.categorie_id → categories.id → categories.id_category → category.legacy_ps_id
 *  - image_url   : reprise telle quelle dans product_media (MinIO ou ancien site)
 *
 * legacy_ps_id (product) = products.id source.
 * Limite : passer un nombre en argument pour un échantillon (ex. `... 04-products.ts 1000`).
 */
import { source, target, slugify, money, progress, closeAll } from './_shared';

const LIMIT = process.argv[2] ? Number(process.argv[2]) : null;
const BATCH = 1000;

// --- Mapping marques : marques.id → brand.id cible ---
const brandMap = await target`SELECT id, legacy_ps_id FROM brand WHERE legacy_ps_id IS NOT NULL`;
const brandByLegacy = new Map<number, number>(
	brandMap.map((r) => [Number(r.legacy_ps_id), Number(r.id)])
);

// --- Mapping catégories : categories.id (source PK) → category.id cible ---
// category.legacy_ps_id = id_category, donc on passe par la table source pour relier id → id_category.
const srcCats = await source`SELECT id, id_category FROM categories`;
const idCatBySrcId = new Map<number, number>(srcCats.map((r) => [Number(r.id), Number(r.id_category)]));
const catMap = await target`SELECT id, legacy_ps_id FROM category WHERE legacy_ps_id IS NOT NULL`;
const catByLegacy = new Map<number, number>(catMap.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

// --- Produits déjà importés (idempotence) ---
const existing = await target`SELECT legacy_ps_id FROM product WHERE legacy_ps_id IS NOT NULL`;
const alreadyImported = new Set<number>(existing.map((r) => Number(r.legacy_ps_id)));

const [{ total }] = await source`SELECT COUNT(*)::int AS total FROM products`;
const totalToProcess = LIMIT ?? Number(total);
console.log(`Produits source : ${total}${LIMIT ? ` (échantillon: ${LIMIT})` : ''}`);

const p = progress('products');
let processed = 0;
let inserted = 0;
let offset = 0;

while (offset < totalToProcess) {
	const take = Math.min(BATCH, totalToProcess - offset);
	const rows = await source`
		SELECT id, nom, description_courte, description, prix_ht, prix_achat, prix_ht_barre,
		       reference, code_barre, stock, poids, actif, marque_id, categorie_id,
		       image_url, slug, meta_title, meta_description, fournisseur,
		       longueur_cm, largeur_cm, hauteur_cm, shipping_extra_fee_eur,
		       date_creation, date_maj
		FROM products
		ORDER BY id
		LIMIT ${take} OFFSET ${offset}`;

	if (rows.length === 0) break;

	const productRows: Record<string, unknown>[] = [];
	const mediaByLegacy: { legacyProductId: number; url: string }[] = [];

	for (const r of rows) {
		if (alreadyImported.has(Number(r.id))) continue;

		const catSrcId = r.categorie_id ? Number(r.categorie_id) : null;
		const idCategory = catSrcId ? idCatBySrcId.get(catSrcId) : null;
		const categoryId = idCategory ? (catByLegacy.get(idCategory) ?? null) : null;
		const brandId = r.marque_id ? (brandByLegacy.get(Number(r.marque_id)) ?? null) : null;

		productRows.push({
			name: r.nom || `Produit ${r.id}`,
			reference: r.reference || `REF-${r.id}`,
			supplier_reference: r.fournisseur || null,
			ean13: r.code_barre ? String(r.code_barre).slice(0, 13) : null,
			brand_id: brandId,
			category_id: categoryId,
			slug: slugify(r.slug || r.nom || `produit-${r.id}`) || `produit-${r.id}`,
			short_description: r.description_courte || null,
			description: r.description || null,
			meta_title: r.meta_title || null,
			meta_description: r.meta_description || null,
			price_ht: money(r.prix_ht),
			price_ht_strike: r.prix_ht_barre != null ? money(r.prix_ht_barre) : null,
			purchase_price: r.prix_achat != null ? money(r.prix_achat) : null,
			stock: Number.isInteger(Number(r.stock)) ? Number(r.stock) : 0,
			weight_kg: r.poids != null ? money(r.poids) : null,
			length_cm: r.longueur_cm != null ? money(r.longueur_cm) : null,
			width_cm: r.largeur_cm != null ? money(r.largeur_cm) : null,
			height_cm: r.hauteur_cm != null ? money(r.hauteur_cm) : null,
			shipping_extra_fee: r.shipping_extra_fee_eur != null ? money(r.shipping_extra_fee_eur) : null,
			is_active: r.actif === 1 || r.actif === true,
			legacy_ps_id: Number(r.id),
			created_at: r.date_creation || new Date(),
			updated_at: r.date_maj || new Date()
		});

		if (r.image_url) mediaByLegacy.push({ legacyProductId: Number(r.id), url: r.image_url });
	}

	if (productRows.length > 0) {
		await target`INSERT INTO product ${target(productRows)}`;
		inserted += productRows.length;

		// Médias : on remappe via les legacy_ps_id fraîchement insérés.
		if (mediaByLegacy.length > 0) {
			const legacyIds = mediaByLegacy.map((m) => m.legacyProductId);
			const newProds = await target`
				SELECT id, legacy_ps_id FROM product WHERE legacy_ps_id = ANY(${legacyIds})`;
			const prodByLegacy = new Map<number, number>(
				newProds.map((r) => [Number(r.legacy_ps_id), Number(r.id)])
			);
			const mediaRows = mediaByLegacy
				.map((m) => {
					const productId = prodByLegacy.get(m.legacyProductId);
					return productId
						? { product_id: productId, type: 'image', url: m.url, position: 0 }
						: null;
				})
				.filter((x): x is Record<string, unknown> => x !== null);
			if (mediaRows.length) await target`INSERT INTO product_media ${target(mediaRows)}`;
		}
	}

	processed += rows.length;
	offset += take;
	p.tick(processed, totalToProcess);
}

p.done(inserted);
console.log(`  (${processed - inserted} déjà importés/ignorés)`);
await closeAll();

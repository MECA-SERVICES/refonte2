import { db } from '$lib/server/db';
import {
	brand,
	category,
	product,
	productVariant,
	productMedia,
	productRelation,
	productCategory,
	taxRule,
	stockMovement
} from '$lib/server/db/schema';
import { and, asc, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { slugify } from '$lib/server/slug';
import {
	buildOrderBy,
	buildWhere,
	pageBounds,
	paginated,
	type ColumnMaps,
	type ListParams
} from '$lib/server/listing';
import { formFields, type ParseResult } from '$lib/server/forms';
import { firstImageSql } from '$lib/server/pricing';
import type {
	NewBrand,
	NewCategory,
	NewTaxRule,
	StockMovementType,
	NewProduct,
	NewProductVariant,
	NewProductMedia
} from '$lib/server/db/catalog.schema';

// Le mécanisme générique de listing (liste blanche de colonnes, recherche,
// tri, pagination) vit dans $lib/server/listing ; ré-exporté pour les routes.
export type { ListParams } from '$lib/server/listing';

// ===========================================================================
// Marques
// ===========================================================================

const BRAND_MAPS: ColumnMaps = {
	text: { name: brand.name, slug: brand.slug },
	exact: {},
	sort: { name: brand.name, createdAt: brand.createdAt },
	defaultSort: brand.name
};

export async function listBrands(params: ListParams = {}) {
	const { page, perPage, offset } = pageBounds(params);
	const where = buildWhere(params, BRAND_MAPS);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select()
			.from(brand)
			.where(where)
			.orderBy(buildOrderBy(params, BRAND_MAPS))
			.limit(perPage)
			.offset(offset),
		db.select({ total: count() }).from(brand).where(where)
	]);

	return paginated(rows, total, page, perPage);
}

export async function getBrand(id: number) {
	const [row] = await db.select().from(brand).where(eq(brand.id, id)).limit(1);
	return row;
}

export async function createBrand(values: NewBrand) {
	const [row] = await db.insert(brand).values(values).returning();
	return row;
}

export async function updateBrand(id: number, values: Partial<NewBrand>) {
	const [row] = await db
		.update(brand)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(brand.id, id))
		.returning();
	return row;
}

export async function deleteBrand(id: number) {
	await db.delete(brand).where(eq(brand.id, id));
}

/** Extrait et valide les champs d'une marque depuis un FormData. */
export function parseBrandForm(form: FormData): ParseResult<NewBrand> {
	const { str, bool } = formFields(form);

	const name = str('name');
	if (!name) return { ok: false, error: 'Le nom est requis.' };

	const slugInput = str('slug');
	return {
		ok: true,
		values: {
			name,
			slug: slugInput ? slugify(slugInput) : slugify(name),
			logoUrl: str('logoUrl'),
			description: str('description'),
			// Contenu de la page de marque (CDC 12).
			heroImageUrl: str('heroImageUrl'),
			tagline: str('tagline'),
			pageContent: form.get('pageContent')?.toString() || null,
			metaTitle: str('metaTitle'),
			metaDescription: str('metaDescription'),
			isActive: bool('isActive')
		}
	};
}

/** Toutes les marques actives (pour les listes déroulantes). */
export function activeBrands() {
	return db
		.select({ id: brand.id, name: brand.name, slug: brand.slug })
		.from(brand)
		.where(eq(brand.isActive, true))
		.orderBy(asc(brand.name));
}

// ===========================================================================
// Catégories (arborescence)
// ===========================================================================

const CATEGORY_MAPS: ColumnMaps = {
	text: { name: category.name, slug: category.slug },
	exact: {},
	sort: { name: category.name, position: category.position },
	defaultSort: category.position
};

export async function listCategories(params: ListParams = {}) {
	const { page, perPage, offset } = pageBounds(params, { maxPerPage: 200, defaultPerPage: 50 });
	const where = buildWhere(params, CATEGORY_MAPS);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select()
			.from(category)
			.where(where)
			.orderBy(buildOrderBy(params, CATEGORY_MAPS))
			.limit(perPage)
			.offset(offset),
		db.select({ total: count() }).from(category).where(where)
	]);

	return paginated(rows, total, page, perPage);
}

export async function getCategory(id: number) {
	const [row] = await db.select().from(category).where(eq(category.id, id)).limit(1);
	return row;
}

export async function createCategory(values: NewCategory) {
	const [row] = await db.insert(category).values(values).returning();
	return row;
}

export async function updateCategory(id: number, values: Partial<NewCategory>) {
	const [row] = await db
		.update(category)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(category.id, id))
		.returning();
	return row;
}

export async function deleteCategory(id: number) {
	await db.delete(category).where(eq(category.id, id));
}

/** Extrait et valide les champs d'une catégorie depuis un FormData. */
export function parseCategoryForm(form: FormData): ParseResult<NewCategory> {
	const { str, int, bool } = formFields(form);

	const name = str('name');
	if (!name) return { ok: false, error: 'Le nom est requis.' };

	const slugInput = str('slug');
	const parentId = int('parentId', 0);

	return {
		ok: true,
		values: {
			name,
			slug: slugInput ? slugify(slugInput) : slugify(name),
			parentId: parentId > 0 ? parentId : null,
			description: str('description'),
			position: int('position'),
			isActive: bool('isActive')
		}
	};
}

/** Toutes les catégories (pour les listes déroulantes de parent / rattachement). */
export function allCategories() {
	return db
		.select({ id: category.id, name: category.name, parentId: category.parentId })
		.from(category)
		.orderBy(asc(category.name));
}

// ===========================================================================
// Produits
// ===========================================================================

const PRODUCT_MAPS: ColumnMaps = {
	text: {
		name: product.name,
		reference: product.reference,
		supplierReference: product.supplierReference,
		ean13: product.ean13
	},
	exact: {},
	sort: {
		name: product.name,
		reference: product.reference,
		priceHt: product.priceHt,
		stock: product.stock,
		createdAt: product.createdAt
	},
	defaultSort: product.createdAt
};

export type ProductListParams = ListParams & {
	brandId?: number;
	categoryId?: number;
	isActive?: boolean;
};

/**
 * Total produits sans filtre : estimation du planificateur (entretenue par
 * autovacuum, exacte à ~0,1 % près) au lieu d'un count(*) qui parcourt les
 * 1,3 M de lignes à chaque affichage de la liste.
 */
export async function estimateProductTotal(): Promise<number> {
	const rows = await db.execute<{ total: string }>(
		sql`SELECT reltuples::bigint AS total FROM pg_class WHERE oid = 'product'::regclass`
	);
	const est = Number(rows[0]?.total ?? -1);
	if (est >= 0) return est;
	// reltuples vaut -1 tant que la table n'a jamais été analysée : count exact.
	const [{ total }] = await db.select({ total: count() }).from(product);
	return total;
}

export async function listProducts(params: ProductListParams = {}) {
	const { page, perPage, offset } = pageBounds(params);

	const conditions: SQL[] = [];
	const base = buildWhere(params, PRODUCT_MAPS);
	if (base) conditions.push(base);
	if (params.brandId) conditions.push(eq(product.brandId, params.brandId));
	if (params.categoryId) conditions.push(eq(product.categoryId, params.categoryId));
	if (typeof params.isActive === 'boolean') conditions.push(eq(product.isActive, params.isActive));
	const where = conditions.length ? and(...conditions) : undefined;

	const [rows, total] = await Promise.all([
		db
			.select({
				id: product.id,
				name: product.name,
				reference: product.reference,
				priceHt: product.priceHt,
				stock: product.stock,
				isActive: product.isActive,
				brandName: brand.name,
				imageUrl: firstImageSql(product.id)
			})
			.from(product)
			.leftJoin(brand, eq(product.brandId, brand.id))
			.where(where)
			.orderBy(buildOrderBy(params, PRODUCT_MAPS))
			.limit(perPage)
			.offset(offset),
		where
			? db
					.select({ total: count() })
					.from(product)
					.where(where)
					.then(([r]) => r.total)
			: estimateProductTotal()
	]);

	return paginated(rows, total, page, perPage);
}

export async function getProduct(id: number) {
	const [row] = await db.select().from(product).where(eq(product.id, id)).limit(1);
	return row;
}

/** Produit + variantes, médias, relations, mouvements de stock et TVA (fiche détail). */
export async function getProductFull(id: number) {
	const row = await getProduct(id);
	if (!row) return undefined;

	const [variants, media, relations, movements, tax, categoryIds] = await Promise.all([
		db
			.select()
			.from(productVariant)
			.where(eq(productVariant.productId, id))
			.orderBy(desc(productVariant.isDefault), asc(productVariant.id)),
		db
			.select()
			.from(productMedia)
			.where(eq(productMedia.productId, id))
			.orderBy(asc(productMedia.position)),
		// Produits associés : le nom et la référence sont joints, sinon la liste
		// n'afficherait que des identifiants.
		db
			.select({
				id: productRelation.id,
				type: productRelation.type,
				position: productRelation.position,
				productId: product.id,
				name: product.name,
				reference: product.reference,
				isActive: product.isActive
			})
			.from(productRelation)
			.innerJoin(product, eq(product.id, productRelation.toProductId))
			.where(eq(productRelation.fromProductId, id))
			.orderBy(asc(productRelation.position), asc(product.name))
			.limit(50),
		db
			.select()
			.from(stockMovement)
			.where(eq(stockMovement.productId, id))
			.orderBy(desc(stockMovement.createdAt))
			.limit(50),
		row.taxRuleId ? getTaxRule(row.taxRuleId) : Promise.resolve(undefined),
		productCategoryIds(id)
	]);

	return { ...row, variants, media, relations, movements, taxRule: tax ?? null, categoryIds };
}

/** Identifiants des catégories additionnelles rattachées au produit. */
export async function productCategoryIds(productId: number): Promise<number[]> {
	const rows = await db
		.select({ categoryId: productCategory.categoryId })
		.from(productCategory)
		.where(eq(productCategory.productId, productId));
	return rows.map((r) => r.categoryId);
}

/**
 * Remplace l'ensemble des catégories additionnelles du produit.
 *
 * La catégorie principale (product.categoryId) est exclue : elle est déjà portée
 * par le produit, la dupliquer ici créerait un doublon d'affichage en boutique.
 */
export async function setProductCategories(
	productId: number,
	categoryIds: number[],
	mainCategoryId?: number | null
) {
	const wanted = [...new Set(categoryIds)].filter((cid) => cid !== mainCategoryId);

	await db.transaction(async (tx) => {
		await tx.delete(productCategory).where(eq(productCategory.productId, productId));
		if (wanted.length > 0) {
			await tx
				.insert(productCategory)
				.values(wanted.map((categoryId) => ({ productId, categoryId })));
		}
	});
}

export async function createProduct(values: NewProduct) {
	const [row] = await db.insert(product).values(values).returning();
	return row;
}

export async function updateProduct(id: number, values: Partial<NewProduct>) {
	const [row] = await db
		.update(product)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(product.id, id))
		.returning();
	return row;
}

export async function deleteProduct(id: number) {
	await db.delete(product).where(eq(product.id, id));
}

/** Extrait et valide les champs d'un produit depuis un FormData. */
export function parseProductForm(form: FormData): ParseResult<NewProduct> {
	const { str, num, int, bool } = formFields(form);

	const name = str('name');
	const reference = str('reference');
	const priceHt = num('priceHt');

	if (!name || !reference || priceHt === null) {
		return { ok: false, error: 'Le nom, la référence (SKU) et le prix HT sont requis.' };
	}

	const slugInput = str('slug');
	const brandRaw = str('brandId');
	const categoryRaw = str('categoryId');
	const taxRaw = str('taxRuleId');

	return {
		ok: true,
		values: {
			name,
			reference,
			priceHt,
			isActive: bool('isActive'),
			supplierReference: str('supplierReference'),
			ean13: str('ean13'),
			brandId: brandRaw ? Number(brandRaw) || null : null,
			categoryId: categoryRaw ? Number(categoryRaw) || null : null,
			taxRuleId: taxRaw ? Number(taxRaw) || null : null,
			slug: slugInput ? slugify(slugInput) : slugify(name),
			shortDescription: str('shortDescription'),
			description: str('description'),
			metaTitle: str('metaTitle'),
			metaDescription: str('metaDescription'),
			priceHtStrike: num('priceHtStrike'),
			purchasePrice: num('purchasePrice'),
			stock: int('stock'),
			weightKg: num('weightKg'),
			lengthCm: num('lengthCm'),
			widthCm: num('widthCm'),
			heightCm: num('heightCm'),
			shippingExtraFee: num('shippingExtraFee')
		}
	};
}

// ----- Variantes -----

export async function addVariant(values: NewProductVariant) {
	const [row] = await db.insert(productVariant).values(values).returning();
	return row;
}

export async function deleteVariant(id: number) {
	await db.delete(productVariant).where(eq(productVariant.id, id));
}

// ----- Médias -----

export async function addMedia(values: NewProductMedia) {
	const [row] = await db.insert(productMedia).values(values).returning();
	return row;
}

export async function deleteMedia(id: number) {
	await db.delete(productMedia).where(eq(productMedia.id, id));
}

// ===========================================================================
// Règles de TVA
// ===========================================================================

export function listTaxRules() {
	return db.select().from(taxRule).orderBy(desc(taxRule.isDefault), asc(taxRule.rate));
}

export async function getTaxRule(id: number) {
	const [row] = await db.select().from(taxRule).where(eq(taxRule.id, id)).limit(1);
	return row;
}

/** Options actives pour les listes déroulantes (avec le taux affiché). */
export function activeTaxRules() {
	return db
		.select({ id: taxRule.id, name: taxRule.name, rate: taxRule.rate })
		.from(taxRule)
		.where(eq(taxRule.isActive, true))
		.orderBy(asc(taxRule.rate));
}

export async function createTaxRule(values: NewTaxRule) {
	// Un seul taux par défaut : on retire le flag des autres si celui-ci l'est.
	if (values.isDefault) await db.update(taxRule).set({ isDefault: false });
	const [row] = await db.insert(taxRule).values(values).returning();
	return row;
}

export async function updateTaxRule(id: number, values: Partial<NewTaxRule>) {
	if (values.isDefault) await db.update(taxRule).set({ isDefault: false });
	const [row] = await db
		.update(taxRule)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(taxRule.id, id))
		.returning();
	return row;
}

export async function deleteTaxRule(id: number) {
	await db.delete(taxRule).where(eq(taxRule.id, id));
}

export function parseTaxRuleForm(form: FormData): ParseResult<NewTaxRule> {
	const { str, num, bool } = formFields(form);

	const name = str('name');
	const rate = num('rate');
	if (!name || rate === null) {
		return { ok: false, error: 'Le libellé et le taux sont requis.' };
	}
	return {
		ok: true,
		values: {
			name,
			rate,
			isActive: bool('isActive'),
			isDefault: bool('isDefault')
		}
	};
}

// ===========================================================================
// Mouvements de stock (inventory)
// ===========================================================================

export function listStockMovements(productId: number) {
	return db
		.select()
		.from(stockMovement)
		.where(eq(stockMovement.productId, productId))
		.orderBy(desc(stockMovement.createdAt));
}

/**
 * Enregistre un mouvement de stock ET ajuste la quantité du produit en conséquence.
 * La quantité passée est le delta (positif = entrée, négatif = sortie).
 */
export async function recordStockMovement(input: {
	productId: number;
	variantId?: number | null;
	quantity: number;
	type: StockMovementType;
	note?: string | null;
	createdBy?: string | null;
}) {
	return db.transaction(async (tx) => {
		const [movement] = await tx
			.insert(stockMovement)
			.values({
				productId: input.productId,
				variantId: input.variantId ?? null,
				quantity: input.quantity,
				type: input.type,
				note: input.note ?? null,
				createdBy: input.createdBy ?? null
			})
			.returning();

		// Ajuste le stock : de la variante si précisée, sinon du produit.
		if (input.variantId) {
			await tx
				.update(productVariant)
				.set({ stock: sql`${productVariant.stock} + ${input.quantity}` })
				.where(eq(productVariant.id, input.variantId));
		} else {
			await tx
				.update(product)
				.set({ stock: sql`${product.stock} + ${input.quantity}` })
				.where(eq(product.id, input.productId));
		}

		return movement;
	});
}

// ----- Produits associés -----

/**
 * Associe un produit à un autre par sa référence (CDC 10).
 *
 * La liaison est orientée : associer A à B ne rend pas B associé à A. C'est le
 * comportement de PrestaShop, dont les 174 797 liaisons ont été reprises.
 */
export async function addProductRelation(fromProductId: number, reference: string) {
	const [target] = await db
		.select({ id: product.id })
		.from(product)
		.where(eq(product.reference, reference))
		.limit(1);

	if (!target) return { error: 'Aucun produit ne porte cette référence.' as const };
	if (target.id === fromProductId) {
		return { error: 'Un produit ne peut pas être associé à lui-même.' as const };
	}

	await db
		.insert(productRelation)
		.values({ fromProductId, toProductId: target.id, type: 'accessory', position: 0 })
		// L'index unique absorbe une association déjà existante.
		.onConflictDoNothing();

	return { ok: true as const };
}

/** Retire une association. */
export async function removeProductRelation(relationId: number) {
	await db.delete(productRelation).where(eq(productRelation.id, relationId));
}

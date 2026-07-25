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
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { slugify } from '$lib/server/slug';
import type {
	NewBrand,
	NewCategory,
	NewTaxRule,
	StockMovementType,
	NewProduct,
	NewProductVariant,
	NewProductMedia
} from '$lib/server/db/catalog.schema';

// ===========================================================================
// Helpers de listing générique (recherche + filtres + tri + pagination serveur)
// ===========================================================================

export type ListParams = {
	search?: string;
	filters?: Record<string, string>;
	sort?: string;
	dir?: 'asc' | 'desc';
	page?: number;
	perPage?: number;
};

type ColumnMaps = {
	text: Record<string, PgColumn>;
	exact: Record<string, PgColumn>;
	sort: Record<string, PgColumn>;
	defaultSort: PgColumn;
};

/** Construit la clause WHERE à partir de la recherche globale et des filtres par colonne. */
function buildWhere(params: ListParams, maps: ColumnMaps): SQL | undefined {
	const conditions: SQL[] = [];

	if (params.search) {
		const term = `%${params.search}%`;
		const parts = Object.values(maps.text).map((col) => ilike(col, term));
		if (parts.length) conditions.push(or(...parts)!);
	}

	for (const [key, raw] of Object.entries(params.filters ?? {})) {
		const value = raw.trim();
		if (!value) continue;
		if (maps.text[key]) conditions.push(ilike(maps.text[key], `%${value}%`));
		else if (maps.exact[key]) conditions.push(eq(maps.exact[key], value));
	}

	return conditions.length ? and(...conditions) : undefined;
}

function buildOrderBy(params: ListParams, maps: ColumnMaps) {
	const col = maps.sort[params.sort ?? ''] ?? maps.defaultSort;
	return params.dir === 'asc' ? asc(col) : desc(col);
}

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
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(100, Math.max(1, params.perPage ?? 20));
	const where = buildWhere(params, BRAND_MAPS);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select()
			.from(brand)
			.where(where)
			.orderBy(buildOrderBy(params, BRAND_MAPS))
			.limit(perPage)
			.offset((page - 1) * perPage),
		db.select({ total: count() }).from(brand).where(where)
	]);

	return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
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
export function parseBrandForm(form: FormData) {
	const name = form.get('name')?.toString().trim();
	if (!name) return { error: 'Le nom est requis.' as const };

	const slugInput = form.get('slug')?.toString().trim();
	return {
		values: {
			name,
			slug: slugInput ? slugify(slugInput) : slugify(name),
			logoUrl: form.get('logoUrl')?.toString().trim() || null,
			description: form.get('description')?.toString().trim() || null,
			isActive: form.get('isActive') != null
		}
	};
}

/** Toutes les marques actives (pour les listes déroulantes). */
export function activeBrands() {
	return db
		.select({ id: brand.id, name: brand.name })
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
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(200, Math.max(1, params.perPage ?? 50));
	const where = buildWhere(params, CATEGORY_MAPS);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select()
			.from(category)
			.where(where)
			.orderBy(buildOrderBy(params, CATEGORY_MAPS))
			.limit(perPage)
			.offset((page - 1) * perPage),
		db.select({ total: count() }).from(category).where(where)
	]);

	return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
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
export function parseCategoryForm(form: FormData) {
	const name = form.get('name')?.toString().trim();
	if (!name) return { error: 'Le nom est requis.' as const };

	const slugInput = form.get('slug')?.toString().trim();
	const parentRaw = form.get('parentId')?.toString().trim();
	const parentId = parentRaw ? Number(parentRaw) : null;

	return {
		values: {
			name,
			slug: slugInput ? slugify(slugInput) : slugify(name),
			parentId: parentId && Number.isInteger(parentId) ? parentId : null,
			description: form.get('description')?.toString().trim() || null,
			position: Number(form.get('position')?.toString() ?? '0') || 0,
			isActive: form.get('isActive') != null
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

export async function listProducts(params: ProductListParams = {}) {
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(100, Math.max(1, params.perPage ?? 20));

	const conditions: SQL[] = [];
	const base = buildWhere(params, PRODUCT_MAPS);
	if (base) conditions.push(base);
	if (params.brandId) conditions.push(eq(product.brandId, params.brandId));
	if (params.categoryId) conditions.push(eq(product.categoryId, params.categoryId));
	if (typeof params.isActive === 'boolean') conditions.push(eq(product.isActive, params.isActive));
	const where = conditions.length ? and(...conditions) : undefined;

	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: product.id,
				name: product.name,
				reference: product.reference,
				priceHt: product.priceHt,
				stock: product.stock,
				isActive: product.isActive,
				brandName: brand.name,
				// Vignette : image de plus petite position. Sous-requête corrélée plutôt
				// qu'une jointure, qui dupliquerait les produits à plusieurs médias.
				imageUrl: sql<string | null>`(
					SELECT m.url FROM ${productMedia} m
					WHERE m.product_id = ${product.id} AND m.type = 'image'
					ORDER BY m.position, m.id
					LIMIT 1
				)`
			})
			.from(product)
			.leftJoin(brand, eq(product.brandId, brand.id))
			.where(where)
			.orderBy(buildOrderBy(params, PRODUCT_MAPS))
			.limit(perPage)
			.offset((page - 1) * perPage),
		db.select({ total: count() }).from(product).where(where)
	]);

	return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
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
		db.select().from(productRelation).where(eq(productRelation.fromProductId, id)),
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

function str(v: FormDataEntryValue | null): string | null {
	const s = v?.toString().trim();
	return s ? s : null;
}

/** Convertit une saisie en nombre décimal (chaîne) ou null. */
function num(v: FormDataEntryValue | null): string | null {
	const s = v?.toString().trim().replace(',', '.');
	if (!s) return null;
	return Number.isNaN(Number(s)) ? null : s;
}

function int(v: FormDataEntryValue | null, fallback = 0): number {
	const n = Number(v?.toString().trim());
	return Number.isInteger(n) ? n : fallback;
}

/** Extrait et valide les champs d'un produit depuis un FormData. */
export function parseProductForm(form: FormData) {
	const name = str(form.get('name'));
	const reference = str(form.get('reference'));
	const priceHt = num(form.get('priceHt'));

	if (!name || !reference || priceHt === null) {
		return { error: 'Le nom, la référence (SKU) et le prix HT sont requis.' as const };
	}

	const slugInput = str(form.get('slug'));
	const brandRaw = form.get('brandId')?.toString().trim();
	const categoryRaw = form.get('categoryId')?.toString().trim();
	const taxRaw = form.get('taxRuleId')?.toString().trim();

	return {
		values: {
			name,
			reference,
			priceHt,
			isActive: form.get('isActive') != null,
			supplierReference: str(form.get('supplierReference')),
			ean13: str(form.get('ean13')),
			brandId: brandRaw ? Number(brandRaw) || null : null,
			categoryId: categoryRaw ? Number(categoryRaw) || null : null,
			taxRuleId: taxRaw ? Number(taxRaw) || null : null,
			slug: slugInput ? slugify(slugInput) : slugify(name),
			shortDescription: str(form.get('shortDescription')),
			description: str(form.get('description')),
			metaTitle: str(form.get('metaTitle')),
			metaDescription: str(form.get('metaDescription')),
			priceHtStrike: num(form.get('priceHtStrike')),
			purchasePrice: num(form.get('purchasePrice')),
			stock: int(form.get('stock')),
			weightKg: num(form.get('weightKg')),
			lengthCm: num(form.get('lengthCm')),
			widthCm: num(form.get('widthCm')),
			heightCm: num(form.get('heightCm')),
			shippingExtraFee: num(form.get('shippingExtraFee'))
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

export function parseTaxRuleForm(form: FormData) {
	const name = str(form.get('name'));
	const rate = num(form.get('rate'));
	if (!name || rate === null) {
		return { error: 'Le libellé et le taux sont requis.' as const };
	}
	return {
		values: {
			name,
			rate,
			isActive: form.get('isActive') != null,
			isDefault: form.get('isDefault') != null
		}
	};
}

/** Calcule le prix TTC à partir d'un prix HT et d'un taux (%). */
export function computeTtc(priceHt: string | number, rate: string | number): number {
	const ht = Number(priceHt);
	const r = Number(rate);
	return Math.round(ht * (1 + r / 100) * 100) / 100;
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

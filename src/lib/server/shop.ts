import { db } from '$lib/server/db';
import {
	brand,
	category,
	product,
	productCategory,
	productMedia,
	productRelation,
	productVariant,
	taxRule
} from '$lib/server/db/schema';
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Category } from '$lib/server/db/catalog.schema';
import { cached } from './cache';

/**
 * Domaine « Vitrine » — requêtes publiques de la boutique.
 *
 * Contrairement aux services admin (catalog.ts), tout ici est restreint aux
 * produits/catégories actifs et expose des prix TTC calculés côté SQL.
 */

export const SHOP_PAGE_SIZE = 24;

/** Prix TTC = HT × (1 + taux de TVA). Produits sans règle de TVA : HT tel quel. */
const priceTtc = sql<string>`round(${product.priceHt} * (1 + coalesce(${taxRule.rate}, 0) / 100), 2)`;
const priceTtcStrike = sql<
	string | null
>`round(${product.priceHtStrike} * (1 + coalesce(${taxRule.rate}, 0) / 100), 2)`;

/** Vignette : première image du produit (position la plus basse). */
const thumbnail = sql<string | null>`(
	SELECT m.url FROM ${productMedia} m
	WHERE m.product_id = ${product.id} AND m.type = 'image'
	ORDER BY m.position, m.id
	LIMIT 1
)`;

/** Champs communs des cartes produit (listes, vignettes, produits liés). */
const productCardFields = {
	id: product.id,
	name: product.name,
	slug: product.slug,
	reference: product.reference,
	stock: product.stock,
	priceTtc,
	priceTtcStrike,
	brandName: brand.name,
	imageUrl: thumbnail
};

export type ShopSort = 'new' | 'price_asc' | 'price_desc' | 'name';

function shopOrderBy(sort: ShopSort | undefined) {
	switch (sort) {
		case 'price_asc':
			return asc(product.priceHt);
		case 'price_desc':
			return desc(product.priceHt);
		case 'name':
			return asc(product.name);
		default:
			return desc(product.createdAt);
	}
}

// ---------------------------------------------------------------------------
// Catégories (menu, arborescence, fils d'Ariane)
// ---------------------------------------------------------------------------

export type ShopMenuChild = {
	id: number;
	name: string;
	slug: string;
	imageUrl?: string | null;
	children?: ShopMenuChild[];
};
export type ShopMenuEntry = ShopMenuChild & { children: ShopMenuChild[] };

/**
 * Descend les racines techniques héritées de PrestaShop (« Racine », puis
 * souvent « Accueil ») : tant qu'un niveau ne contient qu'une seule catégorie
 * avec des enfants, ce sont les enfants qui forment le vrai menu.
 */
function menuLevel<T extends { id: number; parentId: number | null }>(rows: T[]) {
	let level = rows.filter((c) => c.parentId === null);
	const skipped = new Set<number>();
	while (level.length === 1) {
		const children = rows.filter((c) => c.parentId === level[0].id);
		if (children.length === 0) break;
		skipped.add(level[0].id);
		level = children;
	}
	return { level, skipped };
}

/** Toutes les catégories actives (une seule requête, table de petite taille). */
async function activeCategories() {
	return cached('active-categories', async () => {
		return db.select().from(category).where(eq(category.isActive, true));
	}, 600); // 10 minutes
}

/** Récupère TOUTES les images de catégories en une seule requête optimisée. */
async function getCategoryImages(allCategories: Category[]): Promise<Map<number, string>> {
	const categoryIds = allCategories.map((c) => c.id);

	// Requête optimisée : DISTINCT ON pour avoir 1 image par catégorie
	const images = await db
		.selectDistinctOn([product.categoryId], {
			categoryId: product.categoryId,
			url: productMedia.url
		})
		.from(product)
		.innerJoin(productMedia, eq(productMedia.productId, product.id))
		.where(
			and(
				eq(product.isActive, true),
				eq(productMedia.type, 'image'),
				inArray(product.categoryId, categoryIds)
			)
		)
		.orderBy(product.categoryId, asc(productMedia.position));

	// Créer une Map categoryId -> imageUrl
	const imageMap = new Map<number, string>();
	for (const img of images) {
		if (img.categoryId) {
			imageMap.set(img.categoryId, img.url);
		}
	}

	return imageMap;
}

/** Construit récursivement l'arborescence complète des catégories avec images */
function buildCategoryTree(
	rows: Category[],
	imageMap: Map<number, string>,
	parentId: number | null = null,
	depth: number = 0
): ShopMenuChild[] {
	const children = rows.filter((c) => c.parentId === parentId);

	return children.map((cat) => ({
		id: cat.id,
		name: cat.name,
		slug: cat.slug,
		// Charger les images à tous les niveaux (sauf racine depth 0)
		imageUrl: depth > 0 ? (imageMap.get(cat.id) ?? null) : null,
		children: buildCategoryTree(rows, imageMap, cat.id, depth + 1)
	}));
}

/** Catégories de navigation actives + TOUTE leur arborescence (multi-niveaux). */
export async function getShopMenu(): Promise<ShopMenuEntry[]> {
	return cached('shop-menu', async () => {
		const rows = await activeCategories(); // Utilise le cache
		const imageMap = await getCategoryImages(rows); // UNE SEULE requête pour toutes les images

		const { level } = menuLevel(rows);
		// Construire l'arbre complet pour chaque catégorie racine
		return level.map((root) => ({
			id: root.id,
			name: root.name,
			slug: root.slug,
			imageUrl: null, // Pas d'images pour les catégories racines
			children: buildCategoryTree(rows, imageMap, root.id, 1) // depth = 1 pour les enfants
		}));
	}, 600); // 10 minutes
}

/** Ids d'une catégorie et de toute sa descendance (parcours en mémoire). */
function descendantIds(all: Pick<Category, 'id' | 'parentId'>[], rootId: number): number[] {
	const ids = [rootId];
	for (let i = 0; i < ids.length; i++) {
		for (const c of all) if (c.parentId === ids[i]) ids.push(c.id);
	}
	return ids;
}

/** Fil d'Ariane : ancêtres de la catégorie, de la racine vers la feuille. */
function ancestorsOf(all: Category[], leaf: Category): Category[] {
	const byId = new Map(all.map((c) => [c.id, c]));
	const chain: Category[] = [];
	let current: Category | undefined = leaf;
	while (current && chain.length < 10) {
		chain.unshift(current);
		current = current.parentId != null ? byId.get(current.parentId) : undefined;
	}
	return chain;
}

/** Récupère une catégorie et construit son fil d'Ariane (optimisé pour fiche produit). */
async function getCategoryBreadcrumb(categoryId: number) {
	const all = await activeCategories();
	const cat = all.find((c) => c.id === categoryId);
	if (!cat) return [];

	const { skipped } = menuLevel(all);
	return ancestorsOf(all, cat).filter((c) => !skipped.has(c.id));
}

/** Une catégorie active par slug, avec enfants, ancêtres et ids de sa descendance. */
export async function getShopCategory(slug: string) {
	const all = await activeCategories();
	const cat = all.find((c) => c.slug === slug);
	if (!cat) return undefined;

	// Les racines techniques n'apparaissent ni dans le menu ni dans le fil d'Ariane.
	const { skipped } = menuLevel(all);

	return {
		...cat,
		breadcrumb: ancestorsOf(all, cat).filter((c) => !skipped.has(c.id)),
		children: all
			.filter((c) => c.parentId === cat.id)
			.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
		subtreeIds: descendantIds(all, cat.id)
	};
}

// ---------------------------------------------------------------------------
// Listes de produits (catégorie, recherche, accueil)
// ---------------------------------------------------------------------------

export type ShopListParams = {
	/** Restreint à une catégorie et sa descendance (ids pré-calculés). */
	categoryIds?: number[];
	/** Recherche plein texte : nom, référence, réf. fournisseur, EAN13. */
	search?: string;
	sort?: ShopSort;
	page?: number;
	perPage?: number;
};

/** Liste paginée publique : produits actifs uniquement, prix TTC. */
export async function listShopProducts(params: ShopListParams = {}) {
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(60, Math.max(1, params.perPage ?? SHOP_PAGE_SIZE));

	const conditions: SQL[] = [eq(product.isActive, true)];

	if (params.categoryIds?.length) {
		conditions.push(
			or(
				inArray(product.categoryId, params.categoryIds),
				exists(
					db
						.select({ one: sql`1` })
						.from(productCategory)
						.where(
							and(
								eq(productCategory.productId, product.id),
								inArray(productCategory.categoryId, params.categoryIds)
							)
						)
				)
			)!
		);
	}

	if (params.search) {
		const term = `%${params.search}%`;
		conditions.push(
			or(
				ilike(product.name, term),
				ilike(product.reference, term),
				ilike(product.supplierReference, term),
				ilike(product.ean13, term)
			)!
		);
	}

	const where = and(...conditions);

	// Charger perPage + 1 pour savoir s'il y a une page suivante (évite COUNT coûteux)
	const rows = await db
		.select(productCardFields)
		.from(product)
		.leftJoin(brand, eq(product.brandId, brand.id))
		.leftJoin(taxRule, eq(product.taxRuleId, taxRule.id))
		.where(where)
		.orderBy(shopOrderBy(params.sort), desc(product.id))
		.limit(perPage + 1)
		.offset((page - 1) * perPage);

	// S'il y a plus de résultats que demandé, il y a une page suivante
	const hasNextPage = rows.length > perPage;
	const items = hasNextPage ? rows.slice(0, perPage) : rows;

	return {
		rows: items,
		page,
		perPage,
		hasNextPage,
		// Total estimé basé sur les résultats (pour compatibilité)
		total: hasNextPage ? (page * perPage) + 1 : (page - 1) * perPage + items.length,
		pageCount: hasNextPage ? page + 1 : page
	};
}

/** Marques actives mises en avant sur l'accueil (celles avec logo d'abord). */
export function featuredBrands(limit = 12) {
	return db
		.select({ id: brand.id, name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl })
		.from(brand)
		.where(eq(brand.isActive, true))
		.orderBy(sql`${brand.logoUrl} IS NULL`, asc(brand.name))
		.limit(limit);
}

/** Derniers produits actifs (section « Nouveaux produits » de l'accueil). */
export function latestShopProducts(limit = 8) {
	return db
		.select(productCardFields)
		.from(product)
		.leftJoin(brand, eq(product.brandId, brand.id))
		.leftJoin(taxRule, eq(product.taxRuleId, taxRule.id))
		.where(eq(product.isActive, true))
		.orderBy(desc(product.createdAt), desc(product.id))
		.limit(limit);
}

// ---------------------------------------------------------------------------
// Fiche produit
// ---------------------------------------------------------------------------

export type ShopProductCard = Awaited<ReturnType<typeof latestShopProducts>>[number];

/** Fiche produit publique : produit actif + galerie, variantes, produits liés, fil d'Ariane. */
export async function getShopProduct(id: number) {
	const [row] = await db
		.select({
			id: product.id,
			name: product.name,
			slug: product.slug,
			reference: product.reference,
			supplierReference: product.supplierReference,
			ean13: product.ean13,
			shortDescription: product.shortDescription,
			description: product.description,
			metaTitle: product.metaTitle,
			metaDescription: product.metaDescription,
			stock: product.stock,
			weightKg: product.weightKg,
			priceHt: product.priceHt,
			priceTtc,
			priceTtcStrike,
			taxRate: taxRule.rate,
			brandName: brand.name,
			brandSlug: brand.slug,
			categoryId: product.categoryId
		})
		.from(product)
		.leftJoin(brand, eq(product.brandId, brand.id))
		.leftJoin(taxRule, eq(product.taxRuleId, taxRule.id))
		.where(and(eq(product.id, id), eq(product.isActive, true)))
		.limit(1);

	if (!row) return undefined;

	const [media, variants, related, breadcrumb] = await Promise.all([
		db
			.select()
			.from(productMedia)
			.where(eq(productMedia.productId, id))
			.orderBy(asc(productMedia.position), asc(productMedia.id)),
		db
			.select()
			.from(productVariant)
			.where(eq(productVariant.productId, id))
			.orderBy(desc(productVariant.isDefault), asc(productVariant.id)),
		db
			.select({ ...productCardFields, relationType: productRelation.type })
			.from(productRelation)
			.innerJoin(product, eq(productRelation.toProductId, product.id))
			.leftJoin(brand, eq(product.brandId, brand.id))
			.leftJoin(taxRule, eq(product.taxRuleId, taxRule.id))
			.where(and(eq(productRelation.fromProductId, id), eq(product.isActive, true)))
			.orderBy(asc(productRelation.position)),
		row.categoryId != null ? getCategoryBreadcrumb(row.categoryId) : Promise.resolve([])
	]);

	return {
		...row,
		media,
		variants,
		related,
		breadcrumb
	};
}

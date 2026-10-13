/**
 * Construction des documents Meilisearch à partir de la base.
 *
 * Module partagé entre l'application (`$lib/server/meili.ts`) et les scripts
 * (`scripts/search-index.ts`) : SQL brut via un client `postgres`, imports
 * relatifs uniquement. L'application passe `db.$client`, les scripts
 * `targetDb()`.
 */
import type postgres from 'postgres';

type Sql = postgres.Sql;

/** Document de l'index produits — cf. `PRODUCTS_SETTINGS`. */
export type ProductDocument = {
	id: number;
	name: string;
	reference: string | null;
	supplierReference: string | null;
	/** Références sans séparateurs : « 587420701 » trouve « 587 42 07-01 ». */
	referenceCompact: string[];
	ean13: string | null;
	brand: string | null;
	brandId: number | null;
	/** Catégorie principale, ses ancêtres et les catégories secondaires. */
	categories: string[];
	/** Rangement d'origine du fournisseur (KRAMP), signal invisible en vitrine. */
	supplierCategory: string | null;
	description: string;
	type: string;
	/**
	 * Machine 2, consommable 1, pièce 0 : départage les résultats de pertinence
	 * égale. « karcher » touche 29 149 pièces et 37 machines, toutes nommées
	 * « … | KÄRCHER » : sans ce critère, des rondelles passaient devant les
	 * nettoyeurs haute pression.
	 */
	typeRank: number;
	inStock: boolean;
	/** Caractéristiques « Libellé=Valeur », filtrables et comptées en facettes. */
	specs: string[];
	priceHt: number;
	/** Timestamp Unix (secondes) — tri « nouveautés ». */
	createdAt: number;
	sales: number;
};

export type CategoryDocument = {
	id: number;
	name: string;
	slug: string;
	/** Noms des rayons parents : « Robots de tonte » se trouve aussi par « tondeuses ». */
	parents: string[];
	/** Produits actifs du rayon et de sa descendance — départage à pertinence égale. */
	products: number;
};

export type BrandDocument = {
	id: number;
	name: string;
	slug: string;
	logoUrl: string | null;
	products: number;
};

// ---------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------

/** Longueur de description indexée : au-delà, le texte n'apporte que du bruit. */
const DESCRIPTION_MAX = 600;

/** Rang de chaque nature de produit, cf. `ProductDocument.typeRank`. */
const TYPE_RANK: Record<string, number> = { machine: 2, consumable: 1, part: 0 };

/** Caractéristiques retenues par produit : la longue traîne ne sert pas de filtre. */
const SPECS_MAX = 40;

const HTML_ENTITIES: Record<string, string> = {
	'&nbsp;': ' ',
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'"
};

/** Texte brut d'un fragment HTML, espaces resserrés, tronqué à `max` caractères. */
export function htmlToText(html: string | null, max = DESCRIPTION_MAX): string {
	if (!html) return '';
	const text = html
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? text.slice(0, max) : text;
}

/**
 * Formes compactes des références : sans espaces, tirets, points ni barres.
 *
 * Le client tape « 587 42 07-01 », « 5874207-01 » ou « 587420701 » selon ce
 * qu'il lit sur la pièce : les trois doivent mener au même article.
 */
export function compactReferences(...refs: (string | null | undefined)[]): string[] {
	const compact = refs
		.filter((ref): ref is string => !!ref)
		.map((ref) => ref.replace(/[\s.\-_/]+/g, '').toLowerCase())
		.filter((ref) => ref.length >= 3);
	return [...new Set(compact)];
}

/** EAN exploitable : la reprise contient des « 0 » et des chaînes vides. */
export function cleanEan(ean: string | null): string | null {
	const value = ean?.trim();
	return value && /^\d{8,14}$/.test(value) && !/^0+$/.test(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Contexte commun : arbre des catégories et ventes
// ---------------------------------------------------------------------------

type CategoryNode = {
	id: number;
	name: string;
	slug: string;
	parentId: number | null;
	isActive: boolean;
};

/** Données chargées une fois puis partagées par tous les lots d'une indexation. */
export type IndexContext = {
	categories: Map<number, CategoryNode>;
	/** Score de ventes par produit (absent = jamais vendu). */
	sales: Map<number, number>;
};

/**
 * Rayon fourre-tout de la reprise : il ne décrit rien et ne doit ni nourrir
 * la recherche, ni être proposé dans l'aperçu.
 */
const UNCLASSIFIED_SLUG = 'a-classer';

export async function loadIndexContext(sql: Sql): Promise<IndexContext> {
	const [categoryRows, salesRows] = await Promise.all([
		sql<CategoryNode[]>`
			SELECT id, name, slug, parent_id AS "parentId", is_active AS "isActive" FROM category
		`,
		// Une commande compte une fois par produit, double si elle a moins de
		// deux ans : la demande récente pèse plus que l'historique PrestaShop.
		sql<{ productId: number; score: number }[]>`
			SELECT ol.product_id AS "productId",
			       sum(CASE WHEN o.created_at > now() - interval '2 years' THEN 2 ELSE 1 END)::int AS score
			  FROM (SELECT DISTINCT order_id, product_id FROM order_line WHERE product_id IS NOT NULL) ol
			  JOIN "order" o ON o.id = ol.order_id
			 GROUP BY ol.product_id
		`
	]);

	return {
		categories: new Map(categoryRows.map((c) => [c.id, c])),
		sales: new Map(salesRows.map((r) => [r.productId, r.score]))
	};
}

/**
 * Nom d'un rayon et de ses ancêtres, sans les racines techniques (« Pièces
 * détachées », « Produits » : présentes sur tout le catalogue, elles ne
 * distinguent rien) ni le fourre-tout « À classer ».
 */
export function categoryLineage(
	categories: Map<number, CategoryNode>,
	categoryId: number | null
): string[] {
	const names: string[] = [];
	const seen = new Set<number>();
	let current = categoryId !== null ? categories.get(categoryId) : undefined;
	while (current && !seen.has(current.id)) {
		seen.add(current.id);
		const isRoot = current.parentId === null;
		if (!isRoot && current.isActive && current.slug !== UNCLASSIFIED_SLUG) names.push(current.name);
		current = current.parentId !== null ? categories.get(current.parentId) : undefined;
	}
	return names;
}

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

type ProductRow = {
	id: number;
	isActive: boolean;
	name: string;
	reference: string | null;
	supplierReference: string | null;
	ean13: string | null;
	brandId: number | null;
	brand: string | null;
	categoryId: number | null;
	extraCategoryIds: number[] | null;
	supplierCategoryPath: string | null;
	description: string | null;
	type: string;
	stock: number;
	priceHt: number;
	createdAt: number;
	specs: string[] | null;
};

/** Sélection des produits à (ré)indexer. */
export type ProductScope =
	| { afterId: number; limit: number }
	| { ids: number[] }
	| { brandId: number; afterId: number; limit: number }
	| { categoryIds: number[]; afterId: number; limit: number }
	| { updatedSince: Date; afterId: number; limit: number };

function scopeCondition(sql: Sql, scope: ProductScope) {
	if ('ids' in scope) return sql`p.id IN ${sql(scope.ids)}`;
	if ('brandId' in scope) return sql`p.brand_id = ${scope.brandId} AND p.id > ${scope.afterId}`;
	if ('categoryIds' in scope) {
		return sql`p.id > ${scope.afterId} AND (
			p.category_id IN ${sql(scope.categoryIds)}
			OR EXISTS (SELECT 1 FROM product_category pc
			            WHERE pc.product_id = p.id AND pc.category_id IN ${sql(scope.categoryIds)})
		)`;
	}
	if ('updatedSince' in scope) {
		return sql`p.updated_at >= ${scope.updatedSince} AND p.id > ${scope.afterId}`;
	}
	return sql`p.id > ${scope.afterId}`;
}

function toProductDocument(row: ProductRow, ctx: IndexContext): ProductDocument {
	const categoryNames = [
		...categoryLineage(ctx.categories, row.categoryId),
		...(row.extraCategoryIds ?? []).flatMap((id) => categoryLineage(ctx.categories, id))
	];

	return {
		id: row.id,
		name: row.name,
		reference: row.reference,
		supplierReference: row.supplierReference,
		referenceCompact: compactReferences(row.reference, row.supplierReference),
		ean13: cleanEan(row.ean13),
		brand: row.brand,
		brandId: row.brandId,
		categories: [...new Set(categoryNames)],
		supplierCategory: row.supplierCategoryPath,
		description: htmlToText(row.description),
		type: row.type,
		typeRank: TYPE_RANK[row.type] ?? 0,
		inStock: row.stock > 0,
		specs: (row.specs ?? []).slice(0, SPECS_MAX),
		priceHt: row.priceHt,
		createdAt: row.createdAt,
		sales: ctx.sales.get(row.id) ?? 0
	};
}

/**
 * Lot de produits à indexer, triés par id.
 *
 * Les produits inactifs de la sélection sont renvoyés à part : ils doivent
 * être retirés de l'index (CDC 04-R1 — ni en liste, ni en recherche).
 * `lastId` sert de curseur pour le lot suivant ; `null` quand c'est fini.
 */
export async function fetchProductBatch(
	sql: Sql,
	ctx: IndexContext,
	scope: ProductScope
): Promise<{ documents: ProductDocument[]; inactiveIds: number[]; lastId: number | null }> {
	if ('ids' in scope && scope.ids.length === 0) {
		return { documents: [], inactiveIds: [], lastId: null };
	}

	const limit = 'limit' in scope ? scope.limit : scope.ids.length;
	const rows = await sql<ProductRow[]>`
		SELECT p.id,
		       p.is_active AS "isActive",
		       p.name,
		       p.reference,
		       p.supplier_reference AS "supplierReference",
		       p.ean13,
		       p.brand_id AS "brandId",
		       b.name AS brand,
		       p.category_id AS "categoryId",
		       (SELECT array_agg(pc.category_id) FROM product_category pc
		         WHERE pc.product_id = p.id) AS "extraCategoryIds",
		       p.supplier_category_path AS "supplierCategoryPath",
		       left(p.description, 4000) AS description,
		       p.type,
		       p.stock,
		       p.price_ht::float8 AS "priceHt",
		       extract(epoch FROM p.created_at)::int AS "createdAt",
		       (SELECT array_agg(s.name || '=' || s.value ORDER BY s.name) FROM product_spec s
		         WHERE s.product_id = p.id) AS specs
		  FROM product p
		  LEFT JOIN brand b ON b.id = p.brand_id
		 WHERE ${scopeCondition(sql, scope)}
		 ORDER BY p.id
		 LIMIT ${limit}
	`;

	const documents: ProductDocument[] = [];
	const inactiveIds: number[] = [];
	for (const row of rows) {
		if (row.isActive) documents.push(toProductDocument(row, ctx));
		else inactiveIds.push(row.id);
	}

	const lastId = 'limit' in scope && rows.length === limit ? rows[rows.length - 1].id : null;
	return { documents, inactiveIds, lastId };
}

// ---------------------------------------------------------------------------
// Rayons et marques (aperçu)
// ---------------------------------------------------------------------------

/**
 * Rayons actifs contenant au moins un produit actif, eux-mêmes ou dans leur
 * descendance — un rayon vide n'a rien à faire dans l'aperçu.
 */
export async function fetchCategoryDocuments(
	sql: Sql,
	ctx: IndexContext
): Promise<CategoryDocument[]> {
	const counts = await sql<{ categoryId: number; total: number }[]>`
		SELECT category_id AS "categoryId", count(*)::int AS total FROM (
			SELECT category_id FROM product WHERE is_active AND category_id IS NOT NULL
			UNION ALL
			SELECT pc.category_id FROM product_category pc
			  JOIN product p ON p.id = pc.product_id AND p.is_active
		) t GROUP BY category_id
	`;

	// Chaque produit compte aussi pour tous les ancêtres de son rayon.
	const totals = new Map<number, number>();
	for (const { categoryId, total } of counts) {
		const seen = new Set<number>();
		let current = ctx.categories.get(categoryId);
		while (current && !seen.has(current.id)) {
			seen.add(current.id);
			totals.set(current.id, (totals.get(current.id) ?? 0) + total);
			current = current.parentId !== null ? ctx.categories.get(current.parentId) : undefined;
		}
	}

	return [...ctx.categories.values()]
		.filter(
			(c) =>
				c.isActive &&
				c.parentId !== null &&
				c.slug !== UNCLASSIFIED_SLUG &&
				(totals.get(c.id) ?? 0) > 0
		)
		.map((c) => ({
			id: c.id,
			name: c.name,
			slug: c.slug,
			parents: categoryLineage(ctx.categories, c.parentId),
			products: totals.get(c.id) ?? 0
		}));
}

/** Marques actives ayant au moins un produit actif. */
export async function fetchBrandDocuments(sql: Sql): Promise<BrandDocument[]> {
	return sql<BrandDocument[]>`
		SELECT b.id, b.name, b.slug, b.logo_url AS "logoUrl", count(p.id)::int AS products
		  FROM brand b
		  JOIN product p ON p.brand_id = b.id AND p.is_active
		 WHERE b.is_active
		 GROUP BY b.id
	`;
}

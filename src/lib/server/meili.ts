/**
 * Meilisearch côté application : recherche vitrine et synchronisation de l'index.
 *
 * Meilisearch classe, Postgres affiche : les recherches renvoient des ids
 * ordonnés et des compteurs de facettes, les cartes sont relues en base par
 * `shop.ts`. Index et documents sont définis dans `./search-index/`, partagé
 * avec les scripts d'indexation (`scripts/search-index.ts`).
 *
 * Rien ici ne doit faire tomber la boutique ni le back-office :
 * - une recherche en échec renvoie `null`, et l'appelant retombe sur la
 *   recherche SQL (`search.ts`) ;
 * - une synchronisation en échec est journalisée, jamais remontée : la passe
 *   `search:sync` planifiée rattrape l'écart.
 */
import { Meilisearch, type MultiSearchParams, type SearchParams } from 'meilisearch';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { cached, invalidate } from './cache';
import {
	BRANDS_INDEX,
	CATEGORIES_INDEX,
	cleanSearchQuery,
	PRODUCTS_INDEX
} from './search-index/settings';
import {
	fetchBrandDocuments,
	fetchCategoryDocuments,
	fetchProductBatch,
	loadIndexContext,
	type BrandDocument,
	type CategoryDocument,
	type ProductScope
} from './search-index/documents';

/** Au-delà, la recherche SQL prend le relais : un visiteur n'attend pas. */
const SEARCH_TIMEOUT_MS = 800;
/** Les écritures partent en tâche de fond : elles peuvent prendre leur temps. */
const WRITE_TIMEOUT_MS = 15_000;
/** Lot de réindexation d'une marque ou d'un rayon entier. */
const SYNC_BATCH = 5_000;

let searchClient: Meilisearch | null | undefined;
let writeClient: Meilisearch | null | undefined;

function makeClient(timeout: number): Meilisearch | null {
	if (!env.MEILI_URL || !env.MEILI_API_KEY) return null;
	return new Meilisearch({ host: env.MEILI_URL, apiKey: env.MEILI_API_KEY, timeout });
}

/** Client de recherche, ou `null` si Meilisearch n'est pas configuré. */
function searcher(): Meilisearch | null {
	if (searchClient === undefined) searchClient = makeClient(SEARCH_TIMEOUT_MS);
	return searchClient;
}

function writer(): Meilisearch | null {
	if (writeClient === undefined) writeClient = makeClient(WRITE_TIMEOUT_MS);
	return writeClient;
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

export type CatalogSearchParams = {
	q: string;
	brandIds?: number[];
	inStockOnly?: boolean;
	excludeTypes?: string[];
	specs?: { name: string; value: string }[];
	sort?: 'new' | 'price_asc' | 'price_desc' | 'name';
	page: number;
	perPage: number;
};

export type CatalogSearchResult = {
	ids: number[];
	totalHits: number;
	totalPages: number;
	/** Nombre d'articles par marque, sélection de marque ignorée. */
	brandCounts: Map<number, number>;
	/** Articles en stock, filtre « en stock » ignoré. */
	inStockTotal: number;
	/** Caractéristiques « Libellé=Valeur » et leur fréquence, sélection ignorée. */
	specCounts: { token: string; total: number }[];
	/** Taille du périmètre sans filtre de caractéristique — règle le seuil des facettes. */
	specScopeTotal: number;
};

/** Valeur littérale dans une expression de filtre Meilisearch. */
function quote(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const SORTS: Record<NonNullable<CatalogSearchParams['sort']>, string[] | undefined> = {
	// « Nouveautés » est le tri par défaut de l'URL : sur une recherche, c'est
	// la pertinence qui prime, comme avant.
	new: undefined,
	price_asc: ['priceHt:asc'],
	price_desc: ['priceHt:desc'],
	name: ['name:asc']
};

/**
 * Recherche paginée avec facettes « disjonctives » : chaque facette se compte
 * sans sa propre sélection, pour que les autres options restent cliquables —
 * le comportement des facettes SQL de `shop.ts`.
 *
 * Renvoie `null` si Meilisearch est absent ou en échec.
 */
export async function searchCatalog(
	params: CatalogSearchParams
): Promise<CatalogSearchResult | null> {
	const client = searcher();
	if (!client) return null;

	const q = cleanSearchQuery(params.q);
	const filters = {
		type: params.excludeTypes?.length
			? `type NOT IN [${params.excludeTypes.map(quote).join(', ')}]`
			: null,
		brand: params.brandIds?.length ? `brandId IN [${params.brandIds.join(', ')}]` : null,
		stock: params.inStockOnly ? 'inStock = true' : null,
		specs: params.specs?.length
			? params.specs.map((s) => `specs = ${quote(`${s.name}=${s.value}`)}`).join(' AND ')
			: null
	};
	const filterWithout = (skip?: keyof typeof filters) =>
		Object.entries(filters)
			.filter(([key, value]) => key !== skip && value)
			.map(([, value]) => value as string);

	const facetQuery = (
		skip: keyof typeof filters,
		facet: string
	): SearchParams & { indexUid: string } => ({
		indexUid: PRODUCTS_INDEX,
		q,
		filter: filterWithout(skip),
		facets: [facet],
		limit: 0
	});

	const queries: (SearchParams & { indexUid: string })[] = [
		{
			indexUid: PRODUCTS_INDEX,
			q,
			filter: filterWithout(),
			sort: SORTS[params.sort ?? 'new'],
			page: params.page,
			hitsPerPage: params.perPage,
			attributesToRetrieve: ['id'],
			facets: ['brandId', 'inStock', 'specs']
		}
	];
	// Une facette dont la dimension est filtrée se recompte sans ce filtre.
	if (filters.brand) queries.push(facetQuery('brand', 'brandId'));
	if (filters.stock) queries.push(facetQuery('stock', 'inStock'));
	if (filters.specs) queries.push(facetQuery('specs', 'specs'));

	try {
		const { results } = await client.multiSearch<MultiSearchParams>({ queries });
		const [main, ...extra] = results;
		const facetsOf = (facet: string) =>
			extra.find((r) => r.facetDistribution?.[facet])?.facetDistribution?.[facet] ??
			main.facetDistribution?.[facet] ??
			{};
		const specResult = filters.specs ? extra.find((r) => r.facetDistribution?.specs) : main;

		return {
			ids: main.hits.map((hit) => Number(hit.id)),
			totalHits: main.totalHits ?? 0,
			totalPages: main.totalPages ?? 0,
			brandCounts: new Map(
				Object.entries(facetsOf('brandId')).map(([id, total]) => [Number(id), total])
			),
			inStockTotal: facetsOf('inStock').true ?? 0,
			specCounts: Object.entries(facetsOf('specs')).map(([token, total]) => ({ token, total })),
			specScopeTotal: specResult?.totalHits ?? specResult?.estimatedTotalHits ?? 0
		};
	} catch (cause) {
		console.error('[recherche] Meilisearch en échec, repli SQL', { q: params.q, cause });
		return null;
	}
}

export type PreviewSearchResult = {
	productIds: number[];
	categories: Pick<CategoryDocument, 'name' | 'slug'>[];
	brands: Pick<BrandDocument, 'name' | 'slug' | 'logoUrl'>[];
};

/**
 * Aperçu de la barre de recherche : produits, rayons et marques en une seule
 * requête. `null` si Meilisearch est absent ou en échec.
 */
export async function searchPreview(raw: string): Promise<PreviewSearchResult | null> {
	const client = searcher();
	if (!client) return null;

	const q = cleanSearchQuery(raw);
	try {
		const { results } = await client.multiSearch<MultiSearchParams>({
			queries: [
				{ indexUid: PRODUCTS_INDEX, q, limit: 6, attributesToRetrieve: ['id'] },
				// Davantage que nécessaire : la reprise compte des rayons homonymes
				// (« Accessoires » ×7), dédoublonnés par nom ci-dessous.
				{ indexUid: CATEGORIES_INDEX, q, limit: 8, attributesToRetrieve: ['name', 'slug'] },
				{ indexUid: BRANDS_INDEX, q, limit: 3, attributesToRetrieve: ['name', 'slug', 'logoUrl'] }
			]
		});
		const [products, categories, brands] = results;

		const uniqueCategories = [
			...new Map(
				(categories.hits as Pick<CategoryDocument, 'name' | 'slug'>[]).map((c) => [c.name, c])
			).values()
		].slice(0, 3);

		return {
			productIds: products.hits.map((hit) => Number(hit.id)),
			categories: uniqueCategories,
			brands: brands.hits as Pick<BrandDocument, 'name' | 'slug' | 'logoUrl'>[]
		};
	} catch (cause) {
		console.error('[recherche] aperçu Meilisearch en échec, repli SQL', { q, cause });
		return null;
	}
}

// ---------------------------------------------------------------------------
// Synchronisation
// ---------------------------------------------------------------------------

/**
 * Arbre des rayons et ventes : rechargés au plus toutes les 10 minutes. Un
 * produit enregistré entre-temps porte un score de ventes à peine daté, sans
 * conséquence sur le classement.
 */
const CONTEXT_CACHE_KEY = 'search-index-context';

function indexContext() {
	return cached(CONTEXT_CACHE_KEY, () => loadIndexContext(db.$client), 600);
}

/** Lance une synchronisation sans bloquer l'appelant ; l'échec est journalisé. */
function inBackground(label: string, task: (client: Meilisearch) => Promise<unknown>) {
	const client = writer();
	if (!client) return;
	void task(client).catch((cause) => {
		console.error(`[recherche] synchronisation en échec : ${label}`, { cause });
	});
}

/** Pousse les produits d'une sélection, retire les inactifs ; parcourt les lots. */
async function pushProducts(client: Meilisearch, scope: ProductScope) {
	const ctx = await indexContext();
	const index = client.index(PRODUCTS_INDEX);
	let current: ProductScope | null = scope;

	while (current) {
		const batch = await fetchProductBatch(db.$client, ctx, current);
		if (batch.documents.length > 0) await index.addDocuments(batch.documents);
		if (batch.inactiveIds.length > 0) await index.deleteDocuments(batch.inactiveIds);
		current =
			batch.lastId !== null && 'limit' in current ? { ...current, afterId: batch.lastId } : null;
	}
}

/** Réindexe des produits (création, modification, stock) ; un inactif est retiré. */
export function syncProducts(ids: number[]) {
	if (ids.length === 0) return;
	inBackground(`produits ${ids.join(', ')}`, (client) => pushProducts(client, { ids }));
}

/** Retire des produits de l'index (suppression). */
export function removeProducts(ids: number[]) {
	if (ids.length === 0) return;
	inBackground(`suppression produits ${ids.join(', ')}`, (client) =>
		client.index(PRODUCTS_INDEX).deleteDocuments(ids)
	);
}

/**
 * Marque créée, modifiée ou supprimée : l'index des marques, puis — si son
 * nom a changé — tous ses produits (le nom de marque est cherchable sur
 * chaque fiche).
 */
export function syncBrand(brandId: number, { withProducts }: { withProducts: boolean }) {
	inBackground(`marque ${brandId}`, async (client) => {
		const docs = await fetchBrandDocuments(db.$client);
		const index = client.index(BRANDS_INDEX);
		await index.addDocuments(docs);
		if (!docs.some((d) => d.id === brandId)) await index.deleteDocuments([brandId]);
		if (withProducts) await pushProducts(client, { brandId, afterId: 0, limit: SYNC_BATCH });
	});
}

/**
 * Rayon modifié ou supprimé : l'index des rayons, puis — si son nom, son
 * parent ou son activation ont changé — les produits du rayon et de sa
 * descendance (le nom d'un rayon est cherchable sur chaque fiche rangée en
 * dessous).
 */
export function syncCategory(categoryId: number, { withProducts }: { withProducts: boolean }) {
	inBackground(`rayon ${categoryId}`, async (client) => {
		// L'arbre en cache porte peut-être l'ancien nom : on le recharge, pour
		// cette passe comme pour les fiches enregistrées ensuite.
		invalidate(CONTEXT_CACHE_KEY);
		const ctx = await indexContext();
		const docs = await fetchCategoryDocuments(db.$client, ctx);
		const index = client.index(CATEGORIES_INDEX);
		await index.addDocuments(docs);
		const kept = new Set(docs.map((d) => d.id));
		// Le rayon supprimé n'est plus dans l'arbre : on l'ajoute explicitement.
		const dropped = [...new Set([...ctx.categories.keys(), categoryId])].filter(
			(id) => !kept.has(id)
		);
		if (dropped.length > 0) await index.deleteDocuments(dropped);
		if (!withProducts) return;

		const subtree = [categoryId];
		for (let i = 0; i < subtree.length; i++) {
			for (const c of ctx.categories.values()) {
				if (c.parentId === subtree[i]) subtree.push(c.id);
			}
		}
		await pushProducts(client, { categoryIds: subtree, afterId: 0, limit: SYNC_BATCH });
	});
}

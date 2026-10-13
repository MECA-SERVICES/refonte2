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
	PRODUCTS_INDEX,
	significantQuery,
	SUGGESTIONS_INDEX
} from './search-index/settings';
import { sameSuggestion } from './search-index/suggestions';
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

/**
 * Quand trop peu de fiches contiennent tous les mots, abandonner d'abord les
 * plus fréquents : « de » avant « refroidissement ». La saisie est envoyée
 * telle quelle, mots vides compris (cf. `FRENCH_STOP_WORDS`).
 */
const MATCHING = { matchingStrategy: 'frequency' } as const;

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

	const q = params.q.trim();
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

	// Deux lectures de la même saisie (cf. `significantQuery`) :
	// - la saisie complète classe les résultats : ce qui reprend l'expression
	//   exacte (« plaquette de frein ») passe devant ;
	// - les mots importants délimitent ce qu'on compte : total, pagination et
	//   facettes ne retiennent que les produits qui contiennent « plaquette » ET
	//   « frein ». Sans cela, les 63 « Support plaquette » gonflaient le total
	//   et poussaient leurs marques en tête du filtre.
	const strictQ = significantQuery(q);
	type Scope = 'strict' | 'loose';
	const count = (scope: Scope, filter: string[], facets: string[]) => ({
		indexUid: PRODUCTS_INDEX,
		...(scope === 'strict' ? { q: strictQ, matchingStrategy: 'all' as const } : { q, ...MATCHING }),
		filter,
		facets,
		// `hitsPerPage` plutôt que `limit` : le total est alors exact.
		page: 1,
		hitsPerPage: 0
	});

	// Requêtes nommées, envoyées en un seul aller-retour.
	const named: Record<string, SearchParams & { indexUid: string }> = {
		hits: {
			indexUid: PRODUCTS_INDEX,
			q,
			...MATCHING,
			filter: filterWithout(),
			sort: SORTS[params.sort ?? 'new'],
			page: params.page,
			hitsPerPage: params.perPage,
			attributesToRetrieve: ['id']
		},
		// Le mode se décide sur la saisie seule, avant tout filtre : cocher une
		// marque ne doit pas faire basculer le comptage, ni vider la liste des
		// marques (Kubota, 11 plaquettes, la réduisait à elle-même).
		base: count('strict', [], [])
	};
	// Chaque facette se compte sans sa propre sélection, pour que les autres
	// options restent visibles et cliquables. Les deux modes sont demandés
	// d'emblée : le bon est retenu à la réponse.
	for (const scope of ['strict', 'loose'] as const) {
		named[`${scope}:all`] = count(scope, filterWithout(), ['brandId', 'inStock', 'specs']);
		if (filters.brand) named[`${scope}:brand`] = count(scope, filterWithout('brand'), ['brandId']);
		if (filters.stock) named[`${scope}:stock`] = count(scope, filterWithout('stock'), ['inStock']);
		if (filters.specs) named[`${scope}:specs`] = count(scope, filterWithout('specs'), ['specs']);
	}

	try {
		const names = Object.keys(named);
		const { results } = await client.multiSearch<MultiSearchParams>({
			queries: Object.values(named)
		});
		const byName = new Map(names.map((name, i) => [name, results[i]]));
		const result = (name: string) => byName.get(name)!;

		// Dès qu'un produit contient tous les mots importants, on ne montre que
		// ceux-là : « bougie de préchauffage » chez B&S, ce sont 2 bougies, pas
		// 6 « Module de préchauffage » ou « Bloc de réchauffage » en complément.
		// La recherche large ne sert qu'en dernier recours, quand aucun produit
		// ne contient tous les mots (saisie mal orthographiée, trop précise).
		const scope: Scope = (result('base').totalHits ?? 0) > 0 ? 'strict' : 'loose';
		const scoped = (dimension: keyof typeof filters) =>
			result(filters[dimension] ? `${scope}:${dimension}` : `${scope}:all`);
		const facetsOf = (dimension: keyof typeof filters, facet: string) =>
			scoped(dimension).facetDistribution?.[facet] ?? {};

		const total = result(`${scope}:all`).totalHits ?? 0;
		// Les résultats sont classés par nombre de mots trouvés : ceux qui
		// contiennent tous les mots importants viennent en premier. On coupe la
		// liste à leur nombre, pour que la dernière page ne soit pas complétée
		// par des correspondances partielles.
		const remaining = Math.max(0, total - (params.page - 1) * params.perPage);
		return {
			ids: result('hits')
				.hits.slice(0, remaining)
				.map((hit) => Number(hit.id)),
			totalHits: total,
			totalPages: Math.ceil(total / params.perPage),
			brandCounts: new Map(
				Object.entries(facetsOf('brand', 'brandId')).map(([id, n]) => [Number(id), n])
			),
			inStockTotal: facetsOf('stock', 'inStock').true ?? 0,
			specCounts: Object.entries(facetsOf('specs', 'specs')).map(([token, n]) => ({
				token,
				total: n
			})),
			specScopeTotal: scoped('specs').totalHits ?? 0
		};
	} catch (cause) {
		console.error('[recherche] Meilisearch en échec, repli SQL', { q: params.q, cause });
		return null;
	}
}

export type PreviewSearchResult = {
	/** Saisies proposées (« savon à main ») : un clic lance la recherche. */
	suggestions: string[];
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

	const q = raw.trim();
	try {
		const { results } = await client.multiSearch<MultiSearchParams>({
			queries: [
				{ indexUid: PRODUCTS_INDEX, q, ...MATCHING, limit: 6, attributesToRetrieve: ['id'] },
				// Davantage que nécessaire : la reprise compte des rayons homonymes
				// (« Accessoires » ×7), dédoublonnés par nom ci-dessous.
				{
					indexUid: CATEGORIES_INDEX,
					q,
					...MATCHING,
					limit: 8,
					attributesToRetrieve: ['name', 'slug']
				},
				{ indexUid: BRANDS_INDEX, q, limit: 3, attributesToRetrieve: ['name', 'slug', 'logoUrl'] },
				// Quelques-unes de plus que les 4 affichées : certaines sont écartées
				// ci-dessous comme doublons de la saisie ou d'un rayon. Une suggestion
				// complète toute la saisie : « liquide de refroidissement » ne
				// propose pas « liquide de frein ».
				{
					indexUid: SUGGESTIONS_INDEX,
					q,
					matchingStrategy: 'all',
					limit: 8,
					attributesToRetrieve: ['text']
				},
				// Produits contenant tous les mots importants : même règle que la
				// page de résultats (`searchCatalog`).
				{
					indexUid: PRODUCTS_INDEX,
					q: significantQuery(q),
					matchingStrategy: 'all',
					page: 1,
					hitsPerPage: 0
				}
			]
		});
		const [products, categories, brands, suggestions, strict] = results;
		const strictTotal = strict.totalHits ?? 0;

		const uniqueCategories = [
			...new Map(
				(categories.hits as Pick<CategoryDocument, 'name' | 'slug'>[]).map((c) => [c.name, c])
			).values()
		].slice(0, 3);

		// Une suggestion qui répète la saisie, ou un rayon déjà proposé juste en
		// dessous (« robots de tonte »), n'apporte rien.
		const suggestionTexts = (suggestions.hits as { text: string }[])
			.map((hit) => hit.text)
			.filter(
				(text) =>
					!sameSuggestion(text, q) && !uniqueCategories.some((c) => sameSuggestion(text, c.name))
			)
			.slice(0, 4);

		return {
			suggestions: suggestionTexts,
			productIds: products.hits
				.slice(0, strictTotal > 0 ? strictTotal : undefined)
				.map((hit) => Number(hit.id)),
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

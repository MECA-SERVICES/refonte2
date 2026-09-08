import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getShopCategory,
	listShopProducts,
	shopBrandFacets,
	shopSpecFacets,
	shopStockFacet,
	type ShopListParams,
	type ShopSort
} from '$lib/server/shop';
import { sanitizeHtml } from '$lib/server/sanitize';
import { activeBrands } from '$lib/server/catalog';

const SORTS: ShopSort[] = ['new', 'price_asc', 'price_desc', 'name'];

export const load: PageServerLoad = async ({ params, url }) => {
	const category = await getShopCategory(params.slug);
	if (!category) error(404, 'Catégorie introuvable');

	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	const triRaw = url.searchParams.get('tri') as ShopSort | null;
	const sort: ShopSort = triRaw && SORTS.includes(triRaw) ? triRaw : 'new';

	// Filtres portés par l'URL : partageables et utilisables sans JavaScript.
	const brandSlugs = url.searchParams.getAll('marque');
	const inStockOnly = url.searchParams.get('stock') === '1';

	// Format « Libellé:Valeur » — le libellé peut contenir des espaces, on ne
	// découpe donc qu'au premier deux-points.
	const selectedSpecs = url.searchParams
		.getAll('spec')
		.map((token) => {
			const at = token.indexOf(':');
			return at > 0 ? { name: token.slice(0, at), value: token.slice(at + 1) } : null;
		})
		.filter((s) => s !== null);

	const brands = await activeBrands();
	const selected = brands.filter((b) => brandSlugs.includes(b.slug));

	const filters: ShopListParams = {
		categoryIds: category.subtreeIds,
		brandIds: selected.length > 0 ? selected.map((b) => b.id) : undefined,
		inStockOnly,
		specs: selectedSpecs.length > 0 ? selectedSpecs : undefined
	};

	const [products, brandFacets, inStockTotal, specFacets] = await Promise.all([
		listShopProducts({ ...filters, sort, page }),
		shopBrandFacets(filters),
		shopStockFacet(filters),
		shopSpecFacets(filters)
	]);

	// Les facettes portent l'id de marque ; l'URL, le slug, plus lisible.
	const byId = new Map(brands.map((b) => [b.id, b]));

	return {
		category: {
			id: category.id,
			name: category.name,
			slug: category.slug,
			description: sanitizeHtml(category.description)
		},
		breadcrumb: category.breadcrumb.map((c) => ({ name: c.name, slug: c.slug })),
		children: category.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
		products,
		sort,
		facets: {
			brands: brandFacets
				.map((f) => ({ value: byId.get(f.id)?.slug ?? '', label: f.name, total: f.total }))
				.filter((f) => f.value),
			inStockTotal,
			specs: specFacets
		},
		selected: {
			brands: selected.map((b) => ({ value: b.slug, label: b.name })),
			inStockOnly,
			specs: selectedSpecs.map((s) => `${s.name}:${s.value}`)
		}
	};
};

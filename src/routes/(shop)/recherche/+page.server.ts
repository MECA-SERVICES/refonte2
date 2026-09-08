import type { PageServerLoad } from './$types';
import {
	listShopProducts,
	shopBrandFacets,
	shopSpecFacets,
	shopStockFacet,
	type ShopListParams,
	type ShopSort
} from '$lib/server/shop';
import { activeBrands } from '$lib/server/catalog';

const SORTS: ShopSort[] = ['new', 'price_asc', 'price_desc', 'name'];

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	const triRaw = url.searchParams.get('tri') as ShopSort | null;
	const sort: ShopSort = triRaw && SORTS.includes(triRaw) ? triRaw : 'new';

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
		search: q || undefined,
		brandIds: selected.length > 0 ? selected.map((b) => b.id) : undefined,
		inStockOnly,
		specs: selectedSpecs.length > 0 ? selectedSpecs : undefined
	};

	// Sans terme : on présente simplement les nouveautés du catalogue.
	const [products, brandFacets, inStockTotal, specFacets] = await Promise.all([
		listShopProducts({ ...filters, sort, page }),
		shopBrandFacets(filters),
		shopStockFacet(filters),
		shopSpecFacets(filters)
	]);

	const byId = new Map(brands.map((b) => [b.id, b]));

	return {
		q,
		sort,
		products,
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

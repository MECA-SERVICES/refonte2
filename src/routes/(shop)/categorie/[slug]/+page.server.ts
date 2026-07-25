import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShopCategory, listShopProducts, type ShopSort } from '$lib/server/shop';

const SORTS: ShopSort[] = ['new', 'price_asc', 'price_desc', 'name'];

export const load: PageServerLoad = async ({ params, url }) => {
	const category = await getShopCategory(params.slug);
	if (!category) error(404, 'Catégorie introuvable');

	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	const triRaw = url.searchParams.get('tri') as ShopSort | null;
	const sort: ShopSort = triRaw && SORTS.includes(triRaw) ? triRaw : 'new';

	const products = await listShopProducts({ categoryIds: category.subtreeIds, sort, page });

	return {
		category: {
			id: category.id,
			name: category.name,
			slug: category.slug,
			description: category.description
		},
		breadcrumb: category.breadcrumb.map((c) => ({ name: c.name, slug: c.slug })),
		children: category.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
		products,
		sort
	};
};

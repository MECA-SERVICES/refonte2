import type { PageServerLoad } from './$types';
import { listShopProducts, type ShopSort } from '$lib/server/shop';

const SORTS: ShopSort[] = ['new', 'price_asc', 'price_desc', 'name'];

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	const triRaw = url.searchParams.get('tri') as ShopSort | null;
	const sort: ShopSort = triRaw && SORTS.includes(triRaw) ? triRaw : 'new';

	// Sans terme : on présente simplement les nouveautés du catalogue.
	const products = await listShopProducts({ search: q || undefined, sort, page });

	return { q, sort, products };
};

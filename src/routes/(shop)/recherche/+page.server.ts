import type { PageServerLoad } from './$types';
import { loadShopListing } from '$lib/server/shop';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';

	// Sans terme : on présente simplement les nouveautés du catalogue.
	const listing = await loadShopListing(url, { search: q });

	return { q, ...listing };
};

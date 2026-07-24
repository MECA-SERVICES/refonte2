import type { PageServerLoad } from './$types';
import { listCarts } from '$lib/server/orders';

export const load: PageServerLoad = async ({ url }) => {
	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	const result = await listCarts(page);
	return result;
};

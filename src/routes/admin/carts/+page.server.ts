import type { PageServerLoad } from './$types';
import { cartStats, listCarts } from '$lib/server/orders';

export const load: PageServerLoad = async ({ url }) => {
	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	const [result, stats] = await Promise.all([listCarts(page), cartStats()]);
	return { ...result, stats };
};

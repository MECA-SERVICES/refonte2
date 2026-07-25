import type { PageServerLoad } from './$types';
import { featuredBrands, latestShopProducts } from '$lib/server/shop';
import { estimateProductTotal } from '$lib/server/catalog';

export const load: PageServerLoad = async () => {
	const [latest, productTotal, brands] = await Promise.all([
		latestShopProducts(8),
		estimateProductTotal(),
		featuredBrands(12)
	]);
	return { latest, productTotal, brands };
};

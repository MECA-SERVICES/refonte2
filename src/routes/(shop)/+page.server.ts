import type { PageServerLoad } from './$types';
import { featuredBrands, inStockShopProducts, latestShopProducts } from '$lib/server/shop';
import { estimateProductTotal } from '$lib/server/catalog';

// L'en-tête Cache-Control est posé par le layout boutique, qui porte le panier :
// le redéfinir ici lèverait une erreur (« header is already set »).
export const load: PageServerLoad = async () => {
	const [inStock, latest, productTotal, brands] = await Promise.all([
		inStockShopProducts(12),
		latestShopProducts(12),
		estimateProductTotal(),
		featuredBrands(12)
	]);

	return { inStock, latest, productTotal, brands };
};

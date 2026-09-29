import type { PageServerLoad } from './$types';
import { featuredBrands, inStockShopProducts, latestShopProducts } from '$lib/server/shop';
import { estimateProductTotal } from '$lib/server/catalog';
import { listPublishedArticles } from '$lib/server/blog';

// L'en-tête Cache-Control est posé par le layout boutique, qui porte le panier :
// le redéfinir ici lèverait une erreur (« header is already set »).
export const load: PageServerLoad = async () => {
	const [inStock, latest, productTotal, brands, articles] = await Promise.all([
		inStockShopProducts(10),
		latestShopProducts(10),
		estimateProductTotal(),
		featuredBrands(12),
		listPublishedArticles()
	]);

	return { inStock, latest, productTotal, brands, articles: articles.slice(0, 3) };
};

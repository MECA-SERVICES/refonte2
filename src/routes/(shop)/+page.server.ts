import type { PageServerLoad } from './$types';
import { inStockShopProducts, latestShopProducts } from '$lib/server/shop';
import { estimateProductTotal } from '$lib/server/catalog';
import { listPublishedArticles } from '$lib/server/blog';
import { loadHomeContent } from '$lib/server/home';

// L'en-tête Cache-Control est posé par le layout boutique, qui porte le panier :
// le redéfinir ici lèverait une erreur (« header is already set »).
export const load: PageServerLoad = async () => {
	const [inStock, latest, productTotal, articles, home] = await Promise.all([
		inStockShopProducts(10),
		latestShopProducts(10),
		estimateProductTotal(),
		listPublishedArticles(),
		// Tuiles, catégories et produits phares réglés en back-office (10.1, 10.3, 10.4).
		loadHomeContent()
	]);

	return { inStock, latest, productTotal, articles: articles.slice(0, 3), home };
};

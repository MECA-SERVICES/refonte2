import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShopBrand, listShopProducts, shopBrandFacts, shopBrandRanges } from '$lib/server/shop';
import { sanitizeHtml } from '$lib/server/sanitize';

export const load: PageServerLoad = async ({ params }) => {
	const brand = await getShopBrand(params.slug);
	if (!brand) error(404, 'Marque introuvable');

	const [facts, ranges, products] = await Promise.all([
		shopBrandFacts(brand.id),
		shopBrandRanges(brand.id),
		// Aperçu du catalogue de la marque : le reste s'atteint par la recherche.
		listShopProducts({ brandIds: [brand.id], perPage: 8 })
	]);

	return {
		brand: {
			...brand,
			// Le contenu vient du back-office : nettoyé avant rendu `{@html}`.
			pageContent: sanitizeHtml(brand.pageContent)
		},
		facts,
		ranges,
		products: products.rows
	};
};

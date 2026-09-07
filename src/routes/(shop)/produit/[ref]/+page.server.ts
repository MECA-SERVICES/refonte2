import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShopProduct } from '$lib/server/shop';
import { sanitizeHtml } from '$lib/server/sanitize';

export const load: PageServerLoad = async ({ params }) => {
	// URL au format « <id>-<slug> » (modèle de l'ancienne boutique) ; seul l'id
	// fait foi, les slugs produits n'étant pas uniques dans les données reprises.
	const id = Number.parseInt(params.ref, 10);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Produit introuvable');

	const product = await getShopProduct(id);
	if (!product) error(404, 'Produit introuvable');

	// Les descriptions viennent du back-office : nettoyées avant rendu `{@html}`.
	return {
		product: {
			...product,
			shortDescription: sanitizeHtml(product.shortDescription),
			description: sanitizeHtml(product.description)
		}
	};
};

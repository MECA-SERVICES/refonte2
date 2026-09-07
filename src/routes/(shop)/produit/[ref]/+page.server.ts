import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShopProduct } from '$lib/server/shop';
import { sanitizeHtml } from '$lib/server/sanitize';
import { addToCart } from '$lib/server/cart';
import { resolveCartOwner } from '$lib/server/cart-session';

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

export const actions: Actions = {
	/** Ajout au panier depuis la fiche produit. */
	add: async (event) => {
		// Un visiteur obtient ici son jeton de panier : c'est son premier article.
		const owner = await resolveCartOwner(event, { create: true });
		if (!owner) {
			return fail(400, {
				message: 'Votre compte n’est pas encore rattaché à une fiche client.'
			});
		}

		const form = await event.request.formData();
		const productId = Number(form.get('productId'));
		const quantity = Number(form.get('quantity') ?? 1);
		if (!Number.isInteger(productId)) return fail(400, { message: 'Produit invalide.' });

		const result = await addToCart(owner, { productId, quantity });

		if (!result.ok) {
			return fail(409, {
				message:
					result.reason === 'unavailable'
						? 'Cet article n’est plus disponible à la vente.'
						: 'Produit introuvable.'
			});
		}

		return {
			added: true,
			quantity: result.quantity,
			message: result.capped
				? `Quantité ajustée : ${result.available} article(s) disponible(s).`
				: 'Article ajouté à votre panier.'
		};
	}
};

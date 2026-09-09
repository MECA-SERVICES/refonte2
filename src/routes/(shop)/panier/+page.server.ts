import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addToCart, clearCart, getCart, removeLine, updateLineQuantity } from '$lib/server/cart';
import { resolveCartOwner } from '$lib/server/cart-session';

export const load: PageServerLoad = async (event) => {
	const owner = await resolveCartOwner(event);
	if (!owner) {
		return {
			cart: {
				id: null,
				lines: [],
				totals: { subtotalHt: 0, tax: 0, totalTtc: 0, itemCount: 0 },
				hasBlockingLine: false
			}
		};
	}

	// Le régime du client, résolu par le layout, décide de la TVA des totaux.
	const { tax } = await event.parent();
	return { cart: await getCart(owner, tax.regime) };
};

export const actions: Actions = {
	/** Ajout depuis une carte produit (listes, carrousels d'accueil). */
	add: async (event) => {
		// Un visiteur obtient ici son jeton de panier : c'est son premier article.
		const owner = await resolveCartOwner(event, { create: true });
		if (!owner) return fail(400, { message: 'Panier indisponible.' });

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

		return { message: 'Article ajouté à votre panier.' };
	},

	/** Modification de la quantité d'une ligne. */
	update: async (event) => {
		const owner = await resolveCartOwner(event);
		if (!owner) return fail(400, { message: 'Panier introuvable.' });

		const form = await event.request.formData();
		const lineId = Number(form.get('lineId'));
		const quantity = Number(form.get('quantity'));
		if (!Number.isInteger(lineId)) return fail(400, { message: 'Ligne invalide.' });

		const result = await updateLineQuantity(owner, lineId, quantity);
		if (!result.ok) return fail(404, { message: 'Ligne introuvable.' });

		return {
			message: result.capped ? 'Quantité ajustée au stock disponible.' : undefined
		};
	},

	/** Suppression d'une ligne. */
	remove: async (event) => {
		const owner = await resolveCartOwner(event);
		if (!owner) return fail(400, { message: 'Panier introuvable.' });

		const form = await event.request.formData();
		const lineId = Number(form.get('lineId'));
		if (!Number.isInteger(lineId)) return fail(400, { message: 'Ligne invalide.' });

		await removeLine(owner, lineId);
		return { message: 'Article retiré du panier.' };
	},

	/** Vidage complet du panier. */
	clear: async (event) => {
		const owner = await resolveCartOwner(event);
		if (!owner) return fail(400, { message: 'Panier introuvable.' });

		await clearCart(owner);
		return { message: 'Panier vidé.' };
	}
};

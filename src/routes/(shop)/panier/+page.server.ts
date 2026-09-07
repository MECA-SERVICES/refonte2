import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { clearCart, getCart, removeLine, updateLineQuantity } from '$lib/server/cart';
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

	return { cart: await getCart(owner) };
};

export const actions: Actions = {
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

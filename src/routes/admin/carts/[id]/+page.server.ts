import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCartFull } from '$lib/server/orders';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Panier introuvable');

	const cart = await getCartFull(id);
	if (!cart) throw error(404, 'Panier introuvable');

	return { cart };
};

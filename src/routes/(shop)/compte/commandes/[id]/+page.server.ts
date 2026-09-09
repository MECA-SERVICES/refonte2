import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireCustomer } from '../../guard';
import { getCustomerOrder } from '$lib/server/customer-orders';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const profile = await requireCustomer(locals, url.pathname);

	const id = Number(params.id);
	// Une commande appartenant à un autre client renvoie le même 404 qu'une
	// commande inexistante : rien ne doit trahir son existence (R1).
	if (!Number.isFinite(id)) error(404, 'Commande introuvable');

	const found = await getCustomerOrder(profile.id, id);
	if (!found) error(404, 'Commande introuvable');

	return { order: found };
};

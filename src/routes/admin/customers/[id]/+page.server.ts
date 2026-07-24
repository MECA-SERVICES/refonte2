import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCustomerWithAddresses, deleteCustomer } from '$lib/server/customers';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Client introuvable');

	const customer = await getCustomerWithAddresses(id);
	if (!customer) throw error(404, 'Client introuvable');

	return { customer };
};

export const actions: Actions = {
	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) {
			await deleteCustomer(id);
		}
		throw redirect(303, '/admin/customers');
	}
};

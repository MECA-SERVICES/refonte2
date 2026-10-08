import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getCustomerWithAddresses,
	getCustomerOverview,
	deleteCustomer,
	updateCustomer
} from '$lib/server/customers';
import { listMachines } from '$lib/server/machines';
import { pendingRequestForCustomer } from '$lib/server/account-validation';
import { listThreadsFor } from '$lib/server/support';

function idParam(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Client introuvable');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = idParam(params);

	const customer = await getCustomerWithAddresses(id);
	if (!customer) throw error(404, 'Client introuvable');

	const [overview, machines, pendingRequest, messages] = await Promise.all([
		getCustomerOverview(id, customer.userId),
		listMachines(id),
		// Dossier en cours, pour renvoyer vers l'écran de décision (CDC 08).
		pendingRequestForCustomer(id),
		listThreadsFor({ customerId: id }, 5)
	]);

	return { customer, overview, machines, pendingRequest, messages };
};

export const actions: Actions = {
	/** Note privée du client, enregistrée automatiquement pendant la saisie. */
	saveNote: async ({ params, request }) => {
		const id = idParam(params);
		const note = (await request.formData()).get('privateNote')?.toString() ?? '';
		if (note.length > 10000) return fail(400, { message: 'Note trop longue.' });

		await updateCustomer(id, { privateNote: note.trim() || null });
		return { noteSaved: true };
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) {
			await deleteCustomer(id);
		}
		throw redirect(303, '/admin/customers');
	}
};

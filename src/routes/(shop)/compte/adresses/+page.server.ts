import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCustomer } from '../guard';
import {
	createCustomerAddress,
	deleteCustomerAddress,
	listCustomerAddresses,
	parseAddressForm,
	updateCustomerAddress
} from '$lib/server/addresses';

export const load: PageServerLoad = async ({ locals, url }) => {
	const profile = await requireCustomer(locals, url.pathname);
	return { addresses: await listCustomerAddresses(profile.id) };
};

export const actions: Actions = {
	save: async ({ locals, request, url }) => {
		const profile = await requireCustomer(locals, url.pathname);
		const form = await request.formData();

		const parsed = parseAddressForm(form);
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const id = Number(form.get('id'));
		if (id) {
			const updated = await updateCustomerAddress(profile.id, id, parsed.values);
			// Adresse inexistante ou appartenant à un autre client : même réponse,
			// pour ne pas révéler l'existence d'un identifiant tiers.
			if (!updated) return fail(404, { message: 'Adresse introuvable.' });
			return { saved: true };
		}

		await createCustomerAddress(profile.id, parsed.values);
		return { saved: true };
	},

	delete: async ({ locals, request, url }) => {
		const profile = await requireCustomer(locals, url.pathname);
		const form = await request.formData();

		const id = Number(form.get('id'));
		if (!id) return fail(400, { message: 'Adresse introuvable.' });

		const removed = await deleteCustomerAddress(profile.id, id);
		if (!removed) return fail(404, { message: 'Adresse introuvable.' });

		return { deleted: true };
	}
};

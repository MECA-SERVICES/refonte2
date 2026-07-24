import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCustomer, updateCustomer, parseCustomerForm } from '$lib/server/customers';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Client introuvable');

	const customer = await getCustomer(id);
	if (!customer) throw error(404, 'Client introuvable');

	return { customer };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'Client introuvable');

		const parsed = parseCustomerForm(await request.formData());
		if ('error' in parsed) {
			return fail(400, { message: parsed.error });
		}

		await updateCustomer(id, parsed.values);
		throw redirect(303, `/admin/customers/${id}`);
	}
};

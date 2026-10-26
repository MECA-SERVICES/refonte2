import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createCustomerWithAccount, parseCustomerForm } from '$lib/server/customers';

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const parsed = parseCustomerForm(form);
		if (!parsed.ok) {
			return fail(400, { message: parsed.error });
		}

		const created = await createCustomerWithAccount(parsed.values, event.request.headers);
		if (!created.ok) return fail(400, { message: created.error });

		throw redirect(303, `/admin/customers/${created.customer.id}`);
	}
};

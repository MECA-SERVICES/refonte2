import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createSupplier, parseSupplierForm } from '$lib/server/suppliers';

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseSupplierForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		const id = await createSupplier(parsed.values);
		redirect(303, `/admin/suppliers/${id}`);
	}
};

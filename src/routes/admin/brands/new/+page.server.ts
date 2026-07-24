import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createBrand, parseBrandForm } from '$lib/server/catalog';

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseBrandForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const created = await createBrand(parsed.values);
		throw redirect(303, `/admin/brands/${created.id}`);
	}
};

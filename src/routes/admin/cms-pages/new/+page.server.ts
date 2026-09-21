import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createCmsPage, parseCmsPageForm } from '$lib/server/cms';

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseCmsPageForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const created = await createCmsPage(parsed.values);
		redirect(303, `/admin/cms-pages/${created.id}`);
	}
};

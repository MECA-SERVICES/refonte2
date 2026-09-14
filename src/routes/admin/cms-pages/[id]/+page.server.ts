import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteCmsPage, getCmsPage, parseCmsPageForm, updateCmsPage } from '$lib/server/cms';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Page introuvable');

	const page = await getCmsPage(id);
	if (!page) error(404, 'Page introuvable');

	return { page };
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) error(404, 'Page introuvable');

		const parsed = parseCmsPageForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const updated = await updateCmsPage(id, parsed.values);
		if (!updated) return fail(404, { message: 'Page introuvable.' });

		return { saved: true };
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await deleteCmsPage(id);
		redirect(303, '/admin/cms-pages');
	}
};

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deletePopup, getPopup, parsePopupForm, updatePopup } from '$lib/server/popups';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Pop-up introuvable');

	const popup = await getPopup(id);
	if (!popup) error(404, 'Pop-up introuvable');

	return { popup };
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) error(404, 'Pop-up introuvable');

		const parsed = parsePopupForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const updated = await updatePopup(id, parsed.values);
		if (!updated) return fail(404, { message: 'Pop-up introuvable.' });

		return { saved: true };
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await deletePopup(id);
		redirect(303, '/admin/popups');
	}
};

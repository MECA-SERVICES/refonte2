import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createPopup, parsePopupForm } from '$lib/server/popups';

export const load: PageServerLoad = async () => ({ popup: null });

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parsePopupForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const created = await createPopup(parsed.values);
		redirect(303, `/admin/popups/${created.id}`);
	}
};

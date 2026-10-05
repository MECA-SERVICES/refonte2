import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createSupportCategory,
	listSupportCategories,
	parseSupportCategoryForm
} from '$lib/server/support';

export const load: PageServerLoad = async () => {
	return { rows: await listSupportCategories() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseSupportCategoryForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const result = await createSupportCategory(parsed.values);
		if (!result.ok) return fail(400, { message: result.error });
		return { created: true };
	}
};

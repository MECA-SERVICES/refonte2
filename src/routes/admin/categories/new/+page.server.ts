import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createCategory, allCategories, parseCategoryForm } from '$lib/server/catalog';

export const load: PageServerLoad = async () => {
	const cats = await allCategories();
	return { parentOptions: cats.map((c) => ({ value: String(c.id), name: c.name })) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseCategoryForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const created = await createCategory(parsed.values);
		throw redirect(303, `/admin/categories/${created.id}`);
	}
};

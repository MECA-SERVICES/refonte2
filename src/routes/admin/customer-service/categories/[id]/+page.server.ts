import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	deleteSupportCategory,
	getSupportCategory,
	parseSupportCategoryForm,
	updateSupportCategory
} from '$lib/server/support';

function categoryId(raw: string) {
	const id = Number(raw);
	if (!Number.isInteger(id)) error(404, 'Catégorie introuvable');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const category = await getSupportCategory(categoryId(params.id));
	if (!category) error(404, 'Catégorie introuvable');
	return { category };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const parsed = parseSupportCategoryForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const result = await updateSupportCategory(categoryId(params.id), parsed.values);
		if (!result.ok) return fail(400, { message: result.error });
		redirect(303, '/admin/customer-service/categories');
	},

	delete: async ({ params }) => {
		const result = await deleteSupportCategory(categoryId(params.id));
		if (!result.ok) return fail(400, { message: result.error });
		redirect(303, '/admin/customer-service/categories');
	}
};

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getCategory,
	updateCategory,
	deleteCategory,
	allCategories,
	parseCategoryForm
} from '$lib/server/catalog';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Catégorie introuvable');

	const [cat, cats] = await Promise.all([getCategory(id), allCategories()]);
	if (!cat) throw error(404, 'Catégorie introuvable');

	// Le parent ne peut pas être la catégorie elle-même.
	const parentOptions = cats
		.filter((c) => c.id !== id)
		.map((c) => ({ value: String(c.id), name: c.name }));

	return { category: cat, parentOptions };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'Catégorie introuvable');

		const parsed = parseCategoryForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		await updateCategory(id, parsed.values);
		throw redirect(303, '/admin/categories');
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await deleteCategory(id);
		throw redirect(303, '/admin/categories');
	}
};

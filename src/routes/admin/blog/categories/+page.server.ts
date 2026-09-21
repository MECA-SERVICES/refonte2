import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createBlogCategory,
	deleteBlogCategory,
	listBlogCategoryTree,
	parseCategoryForm,
	updateBlogCategory,
	validateCategoryParent
} from '$lib/server/blog';

export const load: PageServerLoad = async () => ({ rows: await listBlogCategoryTree() });

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const parsed = parseCategoryForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const id = Number(form.get('id'));

		// Rattachement : ni boucle, ni descendant pour parent, ni quatrième niveau.
		const invalid = await validateCategoryParent(parsed.values.parentId, id || undefined);
		if (invalid) return fail(400, { message: invalid });

		if (id) await updateBlogCategory(id, parsed.values);
		else await createBlogCategory(parsed.values);

		return { saved: true };
	},

	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { message: 'Catégorie introuvable.' });

		const result = await deleteBlogCategory(id);
		// R15 : une catégorie portant des articles est conservée, avec un message
		// explicite plutôt qu'une erreur de contrainte.
		if (!result.ok) return fail(400, { message: result.reason });

		return { deleted: true };
	}
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addFeaturedProducts,
	deleteTile,
	HOME_SETTINGS,
	HomeError,
	loadHomeAdmin,
	parseTileForm,
	removeFeaturedCategory,
	removeFeaturedProduct,
	saveFeaturedCategory,
	saveHomeSetting,
	saveTile,
	setFeaturedProductPosition
} from '$lib/server/home';
import { formFields } from '$lib/server/forms';

export const load: PageServerLoad = async () => loadHomeAdmin();

/** Identifiant entier positif lu dans le formulaire, ou null. */
function idOf(form: FormData, key: string): number | null {
	const id = Number(form.get(key));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	saveTile: async ({ request }) => {
		const form = await request.formData();
		const parsed = parseTileForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.error });
		await saveTile(idOf(form, 'id'), parsed.values);
		return { success: true };
	},

	deleteTile: async ({ request }) => {
		const id = idOf(await request.formData(), 'id');
		if (!id) return fail(400, { message: 'Tuile introuvable.' });
		await deleteTile(id);
		return { success: true };
	},

	saveCategory: async ({ request }) => {
		const form = await request.formData();
		const { str, int } = formFields(form);
		const categoryId = idOf(form, 'categoryId');
		if (!categoryId) return fail(400, { message: 'Choisissez une catégorie.' });
		await saveFeaturedCategory(categoryId, str('imageUrl'), int('position', 0));
		return { success: true };
	},

	removeCategory: async ({ request }) => {
		const categoryId = idOf(await request.formData(), 'categoryId');
		if (!categoryId) return fail(400, { message: 'Catégorie introuvable.' });
		await removeFeaturedCategory(categoryId);
		return { success: true };
	},

	addProducts: async ({ request }) => {
		const form = await request.formData();
		try {
			const missing = await addFeaturedProducts(form.get('products')?.toString() ?? '');
			if (missing.length > 0) {
				return fail(400, {
					message: `Introuvable ou inactif : ${missing.join(', ')}. Les autres sont ajoutés.`
				});
			}
			return { success: true };
		} catch (err) {
			if (err instanceof HomeError) return fail(400, { message: err.message });
			throw err;
		}
	},

	removeProduct: async ({ request }) => {
		const productId = idOf(await request.formData(), 'productId');
		if (!productId) return fail(400, { message: 'Produit introuvable.' });
		await removeFeaturedProduct(productId);
		return { success: true };
	},

	productPosition: async ({ request }) => {
		const form = await request.formData();
		const productId = idOf(form, 'productId');
		if (!productId) return fail(400, { message: 'Produit introuvable.' });
		await setFeaturedProductPosition(productId, formFields(form).int('position', 0));
		return { success: true };
	},

	saveFeaturedImage: async ({ request }) => {
		const { str } = formFields(await request.formData());
		await saveHomeSetting(HOME_SETTINGS.featuredImageUrl, str('imageUrl'));
		await saveHomeSetting(HOME_SETTINGS.featuredImageLink, str('imageLink'));
		return { success: true };
	}
};

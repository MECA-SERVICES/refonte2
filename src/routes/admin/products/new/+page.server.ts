import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createProduct,
	activeBrands,
	allCategories,
	activeTaxRules,
	parseProductForm,
	setProductCategories
} from '$lib/server/catalog';

export const load: PageServerLoad = async () => {
	const [brands, cats, taxes] = await Promise.all([
		activeBrands(),
		allCategories(),
		activeTaxRules()
	]);
	return {
		brandOptions: brands.map((b) => ({ value: String(b.id), name: b.name })),
		categoryTree: cats,
		taxOptions: taxes.map((t) => ({
			value: String(t.id),
			name: `${t.name} (${Number(t.rate)} %)`,
			rate: Number(t.rate)
		}))
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const parsed = parseProductForm(form);
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const created = await createProduct({ ...parsed.values, priceUpdatedAt: new Date() });

		const extraCategoryIds = form
			.getAll('categoryIds')
			.map((v) => Number(v.toString()))
			.filter(Number.isInteger);
		if (extraCategoryIds.length > 0) {
			await setProductCategories(created.id, extraCategoryIds, parsed.values.categoryId);
		}

		throw redirect(303, `/admin/products/${created.id}`);
	}
};

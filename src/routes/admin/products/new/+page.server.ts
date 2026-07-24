import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createProduct,
	activeBrands,
	allCategories,
	activeTaxRules,
	parseProductForm
} from '$lib/server/catalog';

export const load: PageServerLoad = async () => {
	const [brands, cats, taxes] = await Promise.all([
		activeBrands(),
		allCategories(),
		activeTaxRules()
	]);
	return {
		brandOptions: brands.map((b) => ({ value: String(b.id), name: b.name })),
		categoryOptions: cats.map((c) => ({ value: String(c.id), name: c.name })),
		taxOptions: taxes.map((t) => ({
			value: String(t.id),
			name: `${t.name} (${Number(t.rate)} %)`,
			rate: Number(t.rate)
		}))
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseProductForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		const created = await createProduct({ ...parsed.values, priceUpdatedAt: new Date() });
		throw redirect(303, `/admin/products/${created.id}`);
	}
};

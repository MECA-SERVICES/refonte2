import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getBrand, updateBrand, deleteBrand, parseBrandForm } from '$lib/server/catalog';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Marque introuvable');

	const brand = await getBrand(id);
	if (!brand) throw error(404, 'Marque introuvable');

	return { brand };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'Marque introuvable');

		const parsed = parseBrandForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		await updateBrand(id, parsed.values);
		throw redirect(303, '/admin/brands');
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await deleteBrand(id);
		throw redirect(303, '/admin/brands');
	}
};

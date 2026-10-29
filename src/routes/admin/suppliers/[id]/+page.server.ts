import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	deleteSupplier,
	getSupplier,
	listSupplierProducts,
	parseSupplierForm,
	SupplierError,
	updateSupplier
} from '$lib/server/suppliers';
import { contactActions, listContacts } from '$lib/server/contacts';

function idParam(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Fournisseur introuvable');
	return id;
}

/** `?q=` : produit cherché parmi ceux du fournisseur ; `?page=` : page de la liste. */
export const load: PageServerLoad = async ({ params, url }) => {
	const id = idParam(params);
	const q = url.searchParams.get('q')?.trim() ?? '';
	const page = Number(url.searchParams.get('page') ?? '1') || 1;
	const [found, products, contacts] = await Promise.all([
		getSupplier(id),
		listSupplierProducts(id, q, page),
		listContacts({ supplierId: id })
	]);
	if (!found) error(404, 'Fournisseur introuvable');
	return { ...found, q, products, contacts };
};

export const actions: Actions = {
	...contactActions((params) => ({ supplierId: idParam(params) })),

	update: async ({ request, params }) => {
		const parsed = parseSupplierForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		await updateSupplier(idParam(params), parsed.values);
		return { success: true };
	},

	delete: async ({ params }) => {
		try {
			await deleteSupplier(idParam(params));
		} catch (err) {
			if (err instanceof SupplierError) return fail(400, { message: err.message });
			throw err;
		}
		redirect(303, '/admin/suppliers');
	}
};

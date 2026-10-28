import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { searchCountableProducts } from '$lib/server/inventory';
import { listStockLocations, StockLocationError } from '$lib/server/stock-locations';
import {
	createIssue,
	createReceipt,
	listSuppliers,
	parseVoucherForm
} from '$lib/server/stock-vouchers';
import { isVoucherKindSlug, VOUCHER_KINDS } from '$lib/stock-vouchers';

/** `?q=` : produit cherché (EAN à la douchette, référence ou nom). */
export const load: PageServerLoad = async ({ params, url }) => {
	if (!isVoucherKindSlug(params.kind)) error(404, 'Page introuvable');
	const q = url.searchParams.get('q')?.trim() ?? '';
	const [locations, found, suppliers] = await Promise.all([
		listStockLocations(),
		searchCountableProducts(q),
		VOUCHER_KINDS[params.kind].kind === 'receipt' ? listSuppliers() : []
	]);
	return { slug: params.kind, q, locations, found, suppliers };
};

export const actions: Actions = {
	create: async ({ request, params, locals }) => {
		if (!isVoucherKindSlug(params.kind)) error(404, 'Page introuvable');
		const kind = VOUCHER_KINDS[params.kind].kind;
		const parsed = parseVoucherForm(await request.formData(), kind);
		if (!parsed.ok) return fail(400, { message: parsed.error });
		let id: number;
		try {
			const createdBy = locals.user?.id ?? null;
			id =
				kind === 'receipt'
					? await createReceipt(parsed.values, createdBy)
					: await createIssue(parsed.values, createdBy);
		} catch (err) {
			if (err instanceof StockLocationError) return fail(400, { message: err.message });
			throw err;
		}
		redirect(303, `/admin/stock/vouchers/${params.kind}/${id}`);
	}
};

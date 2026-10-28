import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cancelVoucher, listStockLocations, StockLocationError } from '$lib/server/stock-locations';
import { getVoucher, labelIdsOf } from '$lib/server/stock-vouchers';
import { isVoucherKindSlug, VOUCHER_KINDS } from '$lib/stock-vouchers';

export const load: PageServerLoad = async ({ params }) => {
	if (!isVoucherKindSlug(params.kind)) error(404, 'Page introuvable');
	const id = Number(params.id);
	const found = Number.isInteger(id) ? await getVoucher(id) : null;
	if (!found || found.voucher.kind !== VOUCHER_KINDS[params.kind].kind)
		error(404, 'Bon introuvable');
	const [locations, labelIds] = await Promise.all([listStockLocations(), labelIdsOf(id)]);
	return { slug: params.kind, ...found, locations, labelIds };
};

export const actions: Actions = {
	/** Annule le bon : ses mouvements sont contrepassés. */
	cancel: async ({ params, locals }) => {
		try {
			await cancelVoucher(Number(params.id), locals.user?.id ?? null);
		} catch (err) {
			if (err instanceof StockLocationError) return fail(400, { message: err.message });
			throw err;
		}
		return { success: true };
	}
};

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listVouchers } from '$lib/server/stock-vouchers';
import { isVoucherKindSlug, VOUCHER_KINDS } from '$lib/stock-vouchers';

/** `?q=` : n° de BL ou de bon, fournisseur, référence produit ; sans : 30 derniers jours. */
export const load: PageServerLoad = async ({ params, url }) => {
	if (!isVoucherKindSlug(params.kind)) error(404, 'Page introuvable');
	const q = url.searchParams.get('q')?.trim() ?? '';
	return {
		slug: params.kind,
		q,
		vouchers: await listVouchers(VOUCHER_KINDS[params.kind].kind, q)
	};
};

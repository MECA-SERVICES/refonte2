import type { PageServerLoad } from './$types';
import {
	listCounterInvoices,
	unpaidSummary,
	type CounterListFilter
} from '$lib/server/counter-invoices';

const FILTERS: CounterListFilter[] = ['all', 'draft', 'unpaid', 'paid', 'credit_note'];

/** `?f=` : onglet (brouillons, impayées…) ; `?q=` : n° ou client. */
export const load: PageServerLoad = async ({ url }) => {
	const f = url.searchParams.get('f') as CounterListFilter;
	const filter = FILTERS.includes(f) ? f : 'all';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const [invoices, unpaid] = await Promise.all([listCounterInvoices(filter, q), unpaidSummary()]);
	return { filter, q, invoices, unpaid };
};

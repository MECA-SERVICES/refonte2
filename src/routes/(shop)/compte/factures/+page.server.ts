import type { PageServerLoad } from './$types';
import { requireCustomer } from '../guard';
import { listCustomerInvoices } from '$lib/server/customer-orders';
import { formatInvoiceNumber } from '$lib/server/invoicing';

export const load: PageServerLoad = async ({ locals, url }) => {
	const profile = await requireCustomer(locals, url.pathname);
	const invoices = await listCustomerInvoices(profile.id);
	return {
		invoices: invoices.map((i) => ({ ...i, number: formatInvoiceNumber(i.number) }))
	};
};

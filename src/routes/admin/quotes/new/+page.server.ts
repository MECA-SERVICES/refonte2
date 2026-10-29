import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { searchInvoiceCustomers } from '$lib/server/counter-invoices';
import { createWalkInCustomer } from '$lib/server/document-actions';
import { createQuote, QuoteError } from '$lib/server/quotes';

/** `?client=` : recherche du client à chiffrer. */
export const load: PageServerLoad = async ({ url }) => {
	const term = url.searchParams.get('client') ?? '';
	return { term, customers: await searchInvoiceCustomers(term) };
};

export const actions: Actions = {
	/** Brouillon pour un client existant. */
	create: async ({ request, locals }) => {
		const customerId = Number((await request.formData()).get('customerId'));
		let id: number;
		try {
			id = await createQuote(customerId, locals.user?.id ?? null);
		} catch (err) {
			if (err instanceof QuoteError) return fail(400, { message: err.message });
			throw err;
		}
		redirect(303, `/admin/quotes/${id}`);
	},

	/** Client de passage, créé sans compte web, puis son devis brouillon. */
	createCustomer: async ({ request, locals }) => {
		const created = await createWalkInCustomer(await request.formData());
		if (!created.ok) return fail(400, { message: created.error });
		const id = await createQuote(created.values.id, locals.user?.id ?? null);
		redirect(303, `/admin/quotes/${id}`);
	}
};

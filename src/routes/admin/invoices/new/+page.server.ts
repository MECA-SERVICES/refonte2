import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	CounterInvoiceError,
	createDraft,
	searchInvoiceCustomers
} from '$lib/server/counter-invoices';
import { createWalkInCustomer } from '$lib/server/document-actions';

/** `?client=` : recherche du client à facturer. */
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
			id = await createDraft(customerId, locals.user?.id ?? null);
		} catch (err) {
			if (err instanceof CounterInvoiceError) return fail(400, { message: err.message });
			throw err;
		}
		redirect(303, `/admin/invoices/${id}`);
	},

	/** Client de passage, créé sans compte web, puis son brouillon de facture. */
	createCustomer: async ({ request, locals }) => {
		const created = await createWalkInCustomer(await request.formData());
		if (!created.ok) return fail(400, { message: created.error });
		const id = await createDraft(created.values.id, locals.user?.id ?? null);
		redirect(303, `/admin/invoices/${id}`);
	}
};

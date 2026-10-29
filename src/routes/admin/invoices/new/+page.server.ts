import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	CounterInvoiceError,
	createDraft,
	searchInvoiceCustomers
} from '$lib/server/counter-invoices';
import { createCustomerWithoutAccount } from '$lib/server/customers';

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

	/**
	 * Client de passage, créé sans compte web (e-mail facultatif), puis son
	 * brouillon de facture.
	 */
	createCustomer: async ({ request, locals }) => {
		const form = await request.formData();
		const str = (k: string) => form.get(k)?.toString().trim() || null;
		const firstName = str('firstName');
		const lastName = str('lastName');
		const companyName = str('companyName');
		if (!lastName && !companyName) {
			return fail(400, { message: 'Indiquez au moins le nom du client ou sa société.' });
		}
		const created = await createCustomerWithoutAccount({
			firstName: firstName ?? '',
			lastName: lastName ?? companyName ?? '',
			companyName,
			email: str('email'),
			phone: str('phone'),
			type: companyName ? 'pro' : 'particulier',
			status: 'validated',
			source: 'comptoir'
		});
		if (!created.ok) return fail(400, { message: created.error });
		const id = await createDraft(created.customer.id, locals.user?.id ?? null);
		redirect(303, `/admin/invoices/${id}`);
	}
};

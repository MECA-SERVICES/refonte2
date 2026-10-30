import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getCustomerWithAddresses,
	getCustomerOverview,
	deleteCustomer,
	updateCustomer
} from '$lib/server/customers';
import { listMachines } from '$lib/server/machines';
import { listCustomerCounterInvoices } from '$lib/server/counter-invoices';
import { listCustomerQuotes } from '$lib/server/quotes';
import { contactActions, listContacts } from '$lib/server/contacts';
import {
	addCustomerCredit,
	deleteCustomerCredit,
	listCustomerCredits,
	parseCreditForm
} from '$lib/server/customer-credits';
import { pendingRequestForCustomer } from '$lib/server/account-validation';
import { listThreadsFor } from '$lib/server/support';

function idParam(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Client introuvable');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = idParam(params);

	const customer = await getCustomerWithAddresses(id);
	if (!customer) throw error(404, 'Client introuvable');

	const [overview, machines, pendingRequest, messages, invoices, quotes, contacts, credits] =
		await Promise.all([
			getCustomerOverview(id, customer.userId),
			listMachines(id),
			// Dossier en cours, pour renvoyer vers l'écran de décision (CDC 08).
			pendingRequestForCustomer(id),
			listThreadsFor({ customerId: id }, 5),
			listCustomerCounterInvoices(id),
			listCustomerQuotes(id),
			listContacts({ customerId: id }),
			listCustomerCredits(id)
		]);

	return {
		customer,
		overview,
		machines,
		pendingRequest,
		messages,
		invoices,
		quotes,
		contacts,
		credits
	};
};

export const actions: Actions = {
	...contactActions((params) => ({ customerId: idParam(params) })),

	/** Crédit saisi à la main : reprise de machine, remise commerciale. */
	addCredit: async ({ params, request, locals }) => {
		const parsed = parseCreditForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		await addCustomerCredit(idParam(params), parsed.values, locals.user?.id ?? null);
		return { success: true };
	},

	deleteCredit: async ({ params, request }) => {
		const creditId = Number((await request.formData()).get('creditId'));
		await deleteCustomerCredit(idParam(params), creditId);
		return { success: true };
	},

	/** Note privée du client, enregistrée automatiquement pendant la saisie. */
	saveNote: async ({ params, request }) => {
		const id = idParam(params);
		const note = (await request.formData()).get('privateNote')?.toString() ?? '';
		if (note.length > 10000) return fail(400, { message: 'Note trop longue.' });

		await updateCustomer(id, { privateNote: note.trim() || null });
		return { noteSaved: true };
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) {
			await deleteCustomer(id);
		}
		throw redirect(303, '/admin/customers');
	}
};

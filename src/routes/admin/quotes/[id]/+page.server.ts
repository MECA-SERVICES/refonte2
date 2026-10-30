import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { searchBillableProducts } from '$lib/server/counter-invoices';
import { lineActions, num, runOrFail } from '$lib/server/document-actions';
import {
	addFreeLine,
	addProductLine,
	decideQuote,
	deleteDraft,
	deleteLine,
	duplicateQuote,
	getQuote,
	invoiceQuote,
	QuoteError,
	sendQuote,
	updateHeader,
	updateLine
} from '$lib/server/quotes';

/** `?q=` : produit ou prestation cherché pour une nouvelle ligne. */
export const load: PageServerLoad = async ({ params, url }) => {
	const id = Number(params.id);
	const found = Number.isInteger(id) ? await getQuote(id) : null;
	if (!found) error(404, 'Devis introuvable');
	const q = url.searchParams.get('q')?.trim() ?? '';
	const products = found.quote.status === 'draft' ? await searchBillableProducts(q) : [];
	return { ...found, q, products };
};

const isRefusal = (err: unknown) => err instanceof QuoteError;
const run = (task: () => Promise<unknown>) => runOrFail(task, isRefusal);

/** Exécute une création, puis ouvre le document créé. */
async function runAndOpen(task: () => Promise<number>, href: (id: number) => string) {
	let id = 0;
	const result = await run(async () => {
		id = await task();
	});
	if ('success' in result) redirect(303, href(id));
	return result;
}

export const actions: Actions = {
	...lineActions({ addProductLine, addFreeLine, updateLine, deleteLine }, isRefusal),

	header: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			updateHeader(Number(params.id), {
				issuedOn: form.get('issuedOn')?.toString() || null,
				customerReference: form.get('customerReference')?.toString().trim() || null,
				deliveryOn: form.get('deliveryOn')?.toString() || null,
				validityDays: num(form, 'validityDays', 15),
				note: form.get('note')?.toString().trim() || null,
				privateNote: form.get('privateNote')?.toString().trim() || null
			})
		);
	},

	send: async ({ params, locals }) =>
		run(() => sendQuote(Number(params.id), locals.user?.id ?? null)),

	accept: async ({ request, params }) => {
		const note = (await request.formData()).get('note')?.toString() ?? '';
		return run(() => decideQuote(Number(params.id), 'accepted', note));
	},

	reject: async ({ request, params }) => {
		const note = (await request.formData()).get('note')?.toString() ?? '';
		return run(() => decideQuote(Number(params.id), 'rejected', note));
	},

	deleteDraft: async ({ params }) => {
		const result = await run(() => deleteDraft(Number(params.id)));
		if ('success' in result) redirect(303, '/admin/quotes');
		return result;
	},

	duplicate: async ({ params, locals }) =>
		runAndOpen(
			() => duplicateQuote(Number(params.id), locals.user?.id ?? null),
			(id) => `/admin/quotes/${id}`
		),

	invoice: async ({ params, locals }) =>
		runAndOpen(
			() => invoiceQuote(Number(params.id), locals.user?.id ?? null),
			(id) => `/admin/invoices/${id}`
		)
};

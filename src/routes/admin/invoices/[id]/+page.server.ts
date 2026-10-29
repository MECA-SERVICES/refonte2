import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	abandonInvoice,
	addFreeLine,
	addProductLine,
	CounterInvoiceError,
	createCreditNote,
	deleteDraft,
	deleteLine,
	getCounterInvoice,
	recordInvoicePayment,
	searchBillableProducts,
	updateHeader,
	updateLine,
	validateInvoice
} from '$lib/server/counter-invoices';
import { parseSettlementForm } from '$lib/server/settlements';
import { lineActions, runOrFail } from '$lib/server/document-actions';
import { quoteOfInvoice } from '$lib/server/quotes';
import {
	exitDocumentStock,
	getDocumentStock,
	parseDocumentExit,
	StockLocationError,
	type DocumentLine,
	type DocumentProductStock
} from '$lib/server/stock-locations';

/** Pièces du catalogue d'une facture : ce que le magasinier sort du stock. */
function stockLines(
	lines: { productId: number | null; productType: string | null; quantity: string }[]
) {
	return lines.flatMap((l) =>
		l.productId && l.productType !== 'service' && Number(l.quantity) > 0
			? [
					{
						productId: l.productId,
						quantity: Math.round(Number(l.quantity))
					} satisfies DocumentLine
				]
			: []
	);
}

/** `?q=` : produit ou prestation cherché pour une nouvelle ligne. */
export const load: PageServerLoad = async ({ params, url }) => {
	const id = Number(params.id);
	const found = Number.isInteger(id) ? await getCounterInvoice(id) : null;
	if (!found) error(404, 'Facture introuvable');
	const q = url.searchParams.get('q')?.trim() ?? '';
	const { invoice } = found;
	// Sortie de stock : une fois la facture validée (le n° sert de pièce), sauf
	// pour une facture d'ordre de réparation (les pièces sortent depuis l'ordre)
	// et pour une facture reprise de Dolibarr (ses pièces y sont déjà sorties).
	const withStock =
		invoice.kind === 'invoice' && invoice.number && !invoice.repairOrderId && !invoice.legacyDoliId;
	const [products, lineStock, quote] = await Promise.all([
		invoice.status === 'draft' ? searchBillableProducts(q) : [],
		withStock
			? getDocumentStock(stockLines(found.lines), 'sale', invoice.number!)
			: Promise.resolve<Record<number, DocumentProductStock>>({}),
		quoteOfInvoice(invoice.id)
	]);
	return { ...found, q, products, lineStock, quote };
};

const isRefusal = (err: unknown) =>
	err instanceof CounterInvoiceError || err instanceof StockLocationError;
const run = (task: () => Promise<unknown>) => runOrFail(task, isRefusal);

export const actions: Actions = {
	...lineActions({ addProductLine, addFreeLine, updateLine, deleteLine }, isRefusal),

	header: async ({ request, params }) => {
		const form = await request.formData();
		const issuedOn = form.get('issuedOn')?.toString() || null;
		return run(() =>
			updateHeader(Number(params.id), {
				customerId: Number(form.get('customerId')),
				issuedOn,
				note: form.get('note')?.toString().trim() || null,
				privateNote: form.get('privateNote')?.toString().trim() || null
			})
		);
	},

	validate: async ({ params, locals }) =>
		run(() => validateInvoice(Number(params.id), locals.user?.id ?? null)),

	deleteDraft: async ({ params }) => {
		const result = await run(() => deleteDraft(Number(params.id)));
		if ('success' in result) redirect(303, '/admin/invoices');
		return result;
	},

	payment: async ({ request, params, locals }) => {
		const parsed = parseSettlementForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		return run(() =>
			recordInvoicePayment(Number(params.id), parsed.values, locals.user?.id ?? null)
		);
	},

	creditNote: async ({ params, locals }) => {
		let id = 0;
		const result = await run(async () => {
			id = await createCreditNote(Number(params.id), locals.user?.id ?? null);
		});
		if ('success' in result) redirect(303, `/admin/invoices/${id}`);
		return result;
	},

	abandon: async ({ request, params }) => {
		const form = await request.formData();
		return run(() => abandonInvoice(Number(params.id), form.get('reason')?.toString() ?? ''));
	},

	/** Sortie manuelle du stock d'une pièce vendue, par le magasinier. */
	stockExit: async ({ request, params, locals }) => {
		const found = await getCounterInvoice(Number(params.id));
		if (!found?.invoice.number)
			return fail(400, { message: 'Validez la facture avant de sortir le stock.' });
		const exit = parseDocumentExit(await request.formData());
		return run(() =>
			exitDocumentStock({
				lines: stockLines(found.lines),
				type: 'sale',
				reference: found.invoice.number!,
				...exit,
				createdBy: locals.user?.id ?? null
			})
		);
	}
};

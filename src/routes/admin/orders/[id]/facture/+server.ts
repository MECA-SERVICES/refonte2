import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInvoiceForOrder, getInvoiceDocument, issueInvoice } from '$lib/server/invoicing';
import { invoiceFileName, renderInvoicePdf } from '$lib/server/invoice-pdf';
import { requireAdmin } from '$lib/server/guard';

/**
 * Facture d'une commande, au format PDF (CDC 24).
 *
 * La facture est émise à la volée si elle n'existe pas encore : les commandes
 * du nouveau tunnel n'en ont pas, et l'atelier doit pouvoir en produire une
 * sans étape préalable.
 *
 * La garde est explicite : `+layout.server.ts` ne s'applique pas aux routes
 * serveur, cet endpoint serait sinon ouvert à tous.
 */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);

	const orderId = Number(event.params.id);
	if (!Number.isInteger(orderId)) error(404, 'Commande introuvable');

	const invoice = (await getInvoiceForOrder(orderId)) ?? (await issueInvoice(orderId));
	const document = await getInvoiceDocument(invoice.id);
	if (!document) error(404, 'Facture introuvable');

	const pdf = await renderInvoicePdf(document);

	return new Response(new Uint8Array(pdf), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${invoiceFileName(invoice.number)}"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

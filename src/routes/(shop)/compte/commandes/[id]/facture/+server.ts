import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCustomer } from '../../../guard';
import { getCustomerOrder } from '$lib/server/customer-orders';
import { getInvoiceDocument, getInvoiceForOrder } from '$lib/server/invoicing';
import { invoiceFileName, renderInvoicePdf } from '$lib/server/invoice-pdf';

/**
 * Facture du client, au format PDF (CDC 24, R24).
 *
 * La commande est relue via `getCustomerOrder`, qui filtre par client : une
 * commande appartenant à quelqu'un d'autre renvoie le même 404 qu'une commande
 * inexistante, sans rien trahir de son existence.
 *
 * Contrairement au back-office, aucune facture n'est émise ici : le client
 * consulte un document existant, il ne déclenche pas la numérotation.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const profile = await requireCustomer(locals, url.pathname);

	const orderId = Number(params.id);
	if (!Number.isFinite(orderId)) error(404, 'Facture introuvable');

	const found = await getCustomerOrder(profile.id, orderId);
	if (!found) error(404, 'Facture introuvable');

	const invoice = await getInvoiceForOrder(orderId);
	if (!invoice) error(404, 'Facture introuvable');

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

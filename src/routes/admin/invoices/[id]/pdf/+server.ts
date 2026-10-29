import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/guard';
import { getCounterInvoice } from '$lib/server/counter-invoices';
import { renderCounterInvoicePdf } from '$lib/server/counter-invoice-pdf';

/**
 * Facture comptoir ou avoir en PDF. La garde est explicite :
 * `+layout.server.ts` ne s'applique pas aux routes serveur.
 */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const id = Number(event.params.id);
	const doc = Number.isInteger(id) ? await getCounterInvoice(id) : null;
	if (!doc) error(404, 'Facture introuvable');
	const name = doc.invoice.number ?? `brouillon-${doc.invoice.id}`;
	return new Response(new Uint8Array(await renderCounterInvoicePdf(doc)), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${name}.pdf"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

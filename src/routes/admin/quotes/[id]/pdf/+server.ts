import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/guard';
import { getQuote } from '$lib/server/quotes';
import { renderQuotePdf } from '$lib/server/quote-pdf';

/**
 * Devis en PDF, à transmettre au client. La garde est explicite :
 * `+layout.server.ts` ne s'applique pas aux routes serveur.
 */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const id = Number(event.params.id);
	const doc = Number.isInteger(id) ? await getQuote(id) : null;
	if (!doc) error(404, 'Devis introuvable');
	const name = doc.quote.number ?? `devis-brouillon-${doc.quote.id}`;
	return new Response(new Uint8Array(await renderQuotePdf(doc)), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${name}.pdf"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

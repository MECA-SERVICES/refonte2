import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRemittance } from '$lib/server/settlements';
import { renderRemittancePdf } from '$lib/server/remittance-pdf';
import { requireStaff } from '$lib/server/guard';

/**
 * Bordereau de remise en PDF (demande client 1.2).
 *
 * La garde est explicite : `+layout.server.ts` ne s'applique pas aux routes
 * serveur, cet endpoint serait sinon ouvert à tous.
 */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);

	const id = Number(event.params.id);
	if (!Number.isInteger(id)) error(404, 'Bordereau introuvable');

	const remittance = await getRemittance(id);
	if (!remittance) error(404, 'Bordereau introuvable');

	const pdf = await renderRemittancePdf(remittance);

	return new Response(new Uint8Array(pdf), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${remittance.reference}.pdf"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

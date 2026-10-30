import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRepairOrder } from '$lib/server/repairs';
import { renderRepairOrderPdf } from '$lib/server/repair-order-pdf';
import { requireStaff } from '$lib/server/guard';

/**
 * Ordre de réparation en PDF (demande client 13.8).
 *
 * La garde est explicite : `+layout.server.ts` ne s'applique pas aux routes
 * serveur, cet endpoint serait sinon ouvert à tous.
 */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);

	const id = Number(event.params.id);
	if (!Number.isInteger(id)) error(404, 'Ordre introuvable');

	const order = await getRepairOrder(id);
	if (!order) error(404, 'Ordre introuvable');

	const pdf = await renderRepairOrderPdf(order);

	return new Response(new Uint8Array(pdf), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${order.reference}.pdf"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

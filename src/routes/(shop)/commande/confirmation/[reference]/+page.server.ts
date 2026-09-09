import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { customerForUser } from '$lib/server/account';
import { db } from '$lib/server/db';
import { order, orderState } from '$lib/server/db/order.schema';
import { and, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/connexion?redirectTo=${encodeURIComponent(url.pathname)}`);

	const profile = await customerForUser(locals.user.id);
	if (!profile) redirect(303, '/compte');

	const [found] = await db
		.select({
			id: order.id,
			reference: order.reference,
			totalTtc: order.totalTtc,
			carrierName: order.carrierName,
			relayPointName: order.relayPointName,
			stateLabel: orderState.label
		})
		.from(order)
		.innerJoin(orderState, eq(order.stateId, orderState.id))
		// La commande est lue sous son propriétaire : une référence devinée ne
		// donne accès à rien.
		.where(and(eq(order.reference, params.reference), eq(order.customerId, profile.id)))
		.limit(1);

	if (!found) error(404, 'Commande introuvable');

	return { order: found };
};

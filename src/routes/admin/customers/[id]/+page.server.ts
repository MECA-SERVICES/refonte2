import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCustomerWithAddresses, deleteCustomer } from '$lib/server/customers';
import { db } from '$lib/server/db';
import { order, orderState } from '$lib/server/db/order.schema';
import { desc, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Client introuvable');

	const customer = await getCustomerWithAddresses(id);
	if (!customer) throw error(404, 'Client introuvable');

	// Les commandes font le sens d'une fiche client : sans elles, l'écran ne dit
	// rien de la relation commerciale.
	const [orders, [totals]] = await Promise.all([
		db
			.select({
				id: order.id,
				reference: order.reference,
				createdAt: order.createdAt,
				totalTtc: order.totalTtc,
				stateLabel: orderState.label,
				stateColor: orderState.color
			})
			.from(order)
			.innerJoin(orderState, eq(order.stateId, orderState.id))
			.where(eq(order.customerId, id))
			.orderBy(desc(order.createdAt))
			.limit(10),
		db
			.select({
				count: sql<number>`count(*)::int`,
				revenue: sql<string>`coalesce(sum(${order.totalTtc}), 0)::text`,
				lastAt: sql<string | null>`max(${order.createdAt})::text`
			})
			.from(order)
			.where(eq(order.customerId, id))
	]);

	return { customer, orders, totals };
};

export const actions: Actions = {
	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) {
			await deleteCustomer(id);
		}
		throw redirect(303, '/admin/customers');
	}
};

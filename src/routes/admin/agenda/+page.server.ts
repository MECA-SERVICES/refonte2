import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { agendaEvent } from '$lib/server/db/agenda.schema';
import { customer } from '$lib/server/db/customer.schema';

/** Agenda Dolibarr (2021-2022), en lecture seule. */
export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			event: agendaEvent,
			customerName: customer.lastName,
			customerCompany: customer.companyName
		})
		.from(agendaEvent)
		.leftJoin(customer, eq(customer.id, agendaEvent.customerId))
		.orderBy(desc(agendaEvent.startsAt));
	return {
		events: rows.map((r) => ({
			...r.event,
			customerName: r.customerCompany ?? r.customerName
		}))
	};
};

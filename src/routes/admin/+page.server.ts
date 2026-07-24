import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { customer, address } from '$lib/server/db/schema';
import { count, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const [[{ customers }], [{ addresses }], [{ pending }]] = await Promise.all([
		db.select({ customers: count() }).from(customer),
		db.select({ addresses: count() }).from(address),
		db.select({ pending: count() }).from(customer).where(eq(customer.status, 'pending'))
	]);

	return { stats: { customers, addresses, pending } };
};

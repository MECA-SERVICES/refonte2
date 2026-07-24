import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { customer, product, brand, order } from '$lib/server/db/schema';
import { count, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const [[{ customers }], [{ pending }], [{ products }], [{ brands }], [{ orders }]] =
		await Promise.all([
			db.select({ customers: count() }).from(customer),
			db.select({ pending: count() }).from(customer).where(eq(customer.status, 'pending')),
			db.select({ products: count() }).from(product),
			db.select({ brands: count() }).from(brand),
			db.select({ orders: count() }).from(order)
		]);

	return { stats: { customers, pending, products, brands, orders } };
};

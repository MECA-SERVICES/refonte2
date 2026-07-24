import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { customer, address, product, category, brand } from '$lib/server/db/schema';
import { count, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const [
		[{ customers }],
		[{ addresses }],
		[{ pending }],
		[{ products }],
		[{ categories }],
		[{ brands }]
	] = await Promise.all([
		db.select({ customers: count() }).from(customer),
		db.select({ addresses: count() }).from(address),
		db.select({ pending: count() }).from(customer).where(eq(customer.status, 'pending')),
		db.select({ products: count() }).from(product),
		db.select({ categories: count() }).from(category),
		db.select({ brands: count() }).from(brand)
	]);

	return { stats: { customers, addresses, pending, products, categories, brands } };
};

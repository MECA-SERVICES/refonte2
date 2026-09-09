import type { PageServerLoad } from './$types';
import { requireCustomer } from '../guard';
import {
	countCustomerOrders,
	listCustomerOrders,
	ORDERS_PER_PAGE
} from '$lib/server/customer-orders';

export const load: PageServerLoad = async ({ locals, url }) => {
	const profile = await requireCustomer(locals, url.pathname);

	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
	const [orders, total] = await Promise.all([
		listCustomerOrders(profile.id, { page }),
		countCustomerOrders(profile.id)
	]);

	return {
		orders,
		page,
		hasNextPage: page * ORDERS_PER_PAGE < total,
		total
	};
};

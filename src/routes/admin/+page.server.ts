import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { customer, product, brand, order } from '$lib/server/db/schema';
import { count, eq } from 'drizzle-orm';
import {
	headlineStats,
	marginStats,
	ordersByState,
	revenueByDay,
	topProducts
} from '$lib/server/stats';
import { parseStatsSelection } from '$lib/stats-range';

/**
 * Tableau de bord : compteurs de la boutique, puis statistiques de la
 * période choisie, comparées à une autre (demande client 13.1).
 */
export const load: PageServerLoad = async ({ url }) => {
	const selection = parseStatsSelection(url.searchParams, new Date());
	const { range, compare } = selection;

	const [
		[{ customers }],
		[{ pending }],
		[{ products }],
		[{ brands }],
		[{ orders }],
		headline,
		series,
		compareSeries,
		top,
		states,
		margin
	] = await Promise.all([
		db.select({ customers: count() }).from(customer),
		db.select({ pending: count() }).from(customer).where(eq(customer.status, 'pending')),
		db.select({ products: count() }).from(product),
		db.select({ brands: count() }).from(brand),
		db.select({ orders: count() }).from(order),
		headlineStats(range, compare),
		revenueByDay(range),
		revenueByDay(compare),
		topProducts(range),
		ordersByState(range),
		marginStats(range)
	]);

	return {
		stats: { customers, pending, products, brands, orders },
		selection,
		headline,
		series,
		compareSeries,
		products: top,
		states,
		margin
	};
};

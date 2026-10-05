import type { PageServerLoad } from './$types';
import { requireCustomer } from '../guard';
import {
	countCustomerOrders,
	firstCustomerOrderDate,
	listCustomerOrders,
	listRebuyProducts,
	loadOrderCards,
	ORDERS_PER_PAGE,
	type CustomerOrderFilter
} from '$lib/server/customer-orders';

/** Onglets de l'historique, à la manière des grandes places de marché. */
const TABS = ['commandes', 'racheter', 'en-attente'] as const;
type Tab = (typeof TABS)[number];

/**
 * Fenêtre de dates : `3m`/`6m`/`12m` glissants, une année civile, ou tout.
 * Une valeur inconnue retombe sur le défaut plutôt que d'échouer.
 */
function periodBounds(
	period: string,
	now = new Date()
): Pick<CustomerOrderFilter, 'since' | 'until'> {
	const months = { '3m': 3, '6m': 6, '12m': 12 }[period];
	if (months) {
		const since = new Date(now);
		since.setMonth(since.getMonth() - months);
		return { since };
	}
	if (/^\d{4}$/.test(period)) {
		const year = Number(period);
		return { since: new Date(year, 0, 1), until: new Date(year + 1, 0, 1) };
	}
	return {};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const profile = await requireCustomer(locals, url.pathname);

	const tabParam = url.searchParams.get('onglet') ?? 'commandes';
	const tab: Tab = (TABS as readonly string[]).includes(tabParam) ? (tabParam as Tab) : 'commandes';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const period = url.searchParams.get('periode') ?? 'all';
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

	// Années proposées dans le sélecteur : depuis la première commande du client.
	const oldest = await firstCustomerOrderDate(profile.id);
	const currentYear = new Date().getFullYear();
	const firstYear = oldest ? oldest.getFullYear() : currentYear;
	const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);

	if (tab === 'racheter') {
		return {
			tab,
			q,
			period,
			years,
			page: 1,
			total: 0,
			hasNextPage: false,
			orders: [],
			rebuy: await listRebuyProducts(profile.id)
		};
	}

	const filter: CustomerOrderFilter = {
		q: q || undefined,
		pendingShipment: tab === 'en-attente',
		...periodBounds(period)
	};

	const [orders, total] = await Promise.all([
		listCustomerOrders(profile.id, { page, filter }),
		countCustomerOrders(profile.id, filter)
	]);
	const { linesByOrder, invoiced } = await loadOrderCards(orders.map((o) => o.id));

	return {
		tab,
		q,
		period,
		years,
		page,
		total,
		hasNextPage: page * ORDERS_PER_PAGE < total,
		orders: orders.map((o) => ({
			...o,
			lines: linesByOrder.get(o.id) ?? [],
			hasInvoice: invoiced.has(o.id)
		})),
		rebuy: []
	};
};

import type { PageServerLoad } from './$types';
import {
	headlineStats,
	marginStats,
	ordersByState,
	revenueByDay,
	topProducts,
	type StatsPeriod
} from '$lib/server/stats';

const PERIODS = [7, 30, 90, 365] as const;

export const load: PageServerLoad = async ({ url }) => {
	const raw = Number(url.searchParams.get('jours'));
	// Une période imposée par l'URL doit rester parmi celles proposées : sinon
	// un visiteur pourrait demander dix ans d'agrégation d'un seul paramètre.
	const days: StatsPeriod = (PERIODS as readonly number[]).includes(raw)
		? (raw as StatsPeriod)
		: 30;

	const [headline, series, products, states, margin] = await Promise.all([
		headlineStats(days),
		revenueByDay(days),
		topProducts(days),
		ordersByState(days),
		marginStats(days)
	]);

	return { days, periods: PERIODS, headline, series, products, states, margin };
};

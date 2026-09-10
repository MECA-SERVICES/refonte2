import type { PageServerLoad } from './$types';
import { listOrders, listOrderStates } from '$lib/server/orders';

const FILTER_KEYS = ['reference', 'customer'] as const;

/** Nombre décodé depuis l'URL, ou `undefined` si absent ou invalide. */
function numberParam(raw: string | null): number | undefined {
	if (!raw) return undefined;
	const value = Number(raw.replace(',', '.'));
	return Number.isFinite(value) ? value : undefined;
}

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams;

	const filters: Record<string, string> = {};
	for (const key of FILTER_KEYS) {
		const value = q.get(`f_${key}`);
		if (value) filters[key] = value;
	}

	// Plusieurs états peuvent être cumulés : « préparation » et « paiement
	// accepté » forment ensemble la file de travail d'un préparateur.
	const stateIds = q
		.getAll('state')
		.map((v) => Number(v))
		.filter((v) => Number.isInteger(v) && v > 0);

	const shippedRaw = q.get('shipped');
	const shipped = shippedRaw === '1' ? true : shippedRaw === '0' ? false : undefined;

	const search = q.get('q')?.trim() || undefined;
	const dateFrom = q.get('from') || undefined;
	const dateTo = q.get('to') || undefined;
	const minTotal = numberParam(q.get('min'));
	const maxTotal = numberParam(q.get('max'));

	const sort = q.get('sort') ?? undefined;
	const dir = q.get('dir') === 'asc' ? 'asc' : q.get('dir') === 'desc' ? 'desc' : undefined;
	const page = Number(q.get('page') ?? '1') || 1;

	const [result, states] = await Promise.all([
		listOrders({
			filters,
			search,
			stateIds,
			dateFrom,
			dateTo,
			minTotal,
			maxTotal,
			shipped,
			sort,
			dir,
			page
		}),
		listOrderStates()
	]);

	return {
		...result,
		filters,
		search: search ?? '',
		stateIds,
		dateFrom: dateFrom ?? '',
		dateTo: dateTo ?? '',
		minTotal: q.get('min') ?? '',
		maxTotal: q.get('max') ?? '',
		shipped: shippedRaw ?? '',
		sort: sort ?? '',
		dir: dir ?? 'desc',
		states: states.map((s) => ({
			id: s.id,
			label: s.label,
			color: s.color,
			isShipped: s.isShipped,
			isPaid: s.isPaid
		}))
	};
};

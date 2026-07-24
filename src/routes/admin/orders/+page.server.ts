import type { PageServerLoad } from './$types';
import { listOrders, listOrderStates } from '$lib/server/orders';

const FILTER_KEYS = ['reference', 'customer'] as const;

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams;

	const filters: Record<string, string> = {};
	for (const key of FILTER_KEYS) {
		const value = q.get(`f_${key}`);
		if (value) filters[key] = value;
	}

	const stateId = Number(q.get('state')) || undefined;
	const sort = q.get('sort') ?? undefined;
	const dir = q.get('dir') === 'asc' ? 'asc' : q.get('dir') === 'desc' ? 'desc' : undefined;
	const page = Number(q.get('page') ?? '1') || 1;

	const [result, states] = await Promise.all([
		listOrders({ filters, stateId, sort, dir, page }),
		listOrderStates()
	]);

	return {
		...result,
		filters,
		stateId: stateId ?? null,
		sort: sort ?? '',
		dir: dir ?? 'desc',
		states: states.map((s) => ({ id: s.id, label: s.label, color: s.color }))
	};
};

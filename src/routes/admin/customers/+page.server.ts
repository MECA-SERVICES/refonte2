import type { PageServerLoad } from './$types';
import { listCustomers } from '$lib/server/customers';

/** Clés de filtre par colonne lues depuis l'URL (préfixe f_ pour éviter les collisions). */
const FILTER_KEYS = [
	'firstName',
	'lastName',
	'email',
	'phone',
	'companyName',
	'siret',
	'vatNumber',
	'type',
	'status'
] as const;

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams;

	const filters: Record<string, string> = {};
	for (const key of FILTER_KEYS) {
		const value = q.get(`f_${key}`);
		if (value) filters[key] = value;
	}

	const search = q.get('q') ?? undefined;
	const sort = q.get('sort') ?? undefined;
	const dir = q.get('dir') === 'asc' ? 'asc' : q.get('dir') === 'desc' ? 'desc' : undefined;
	const page = Number(q.get('page') ?? '1') || 1;

	const result = await listCustomers({ search, filters, sort, dir, page });

	return {
		...result,
		search: search ?? '',
		filters,
		sort: sort ?? '',
		dir: dir ?? 'desc'
	};
};

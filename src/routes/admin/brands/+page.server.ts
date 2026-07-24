import type { PageServerLoad } from './$types';
import { listBrands } from '$lib/server/catalog';

const FILTER_KEYS = ['name', 'slug'] as const;

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams;

	const filters: Record<string, string> = {};
	for (const key of FILTER_KEYS) {
		const value = q.get(`f_${key}`);
		if (value) filters[key] = value;
	}

	const sort = q.get('sort') ?? undefined;
	const dir = q.get('dir') === 'asc' ? 'asc' : q.get('dir') === 'desc' ? 'desc' : undefined;
	const page = Number(q.get('page') ?? '1') || 1;

	const result = await listBrands({ filters, sort, dir, page });
	return { ...result, filters, sort: sort ?? '', dir: dir ?? 'asc' };
};

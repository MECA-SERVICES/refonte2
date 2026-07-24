import type { PageServerLoad } from './$types';
import { listCustomers } from '$lib/server/customers';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q') ?? undefined;
	const type = url.searchParams.get('type') ?? undefined;
	const status = url.searchParams.get('status') ?? undefined;
	const page = Number(url.searchParams.get('page') ?? '1') || 1;

	const result = await listCustomers({ search, type, status, page });
	return { ...result, search: search ?? '', type: type ?? '', status: status ?? '' };
};

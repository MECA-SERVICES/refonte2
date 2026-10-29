import type { PageServerLoad } from './$types';
import { listSuppliers } from '$lib/server/suppliers';

/** `?q=` : nom, code, e-mail ou ville. */
export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	return { q, suppliers: await listSuppliers(q) };
};

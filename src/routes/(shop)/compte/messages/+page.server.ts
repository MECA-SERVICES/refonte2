import type { PageServerLoad } from './$types';
import { requireCustomer } from '../guard';
import { listCustomerThreads } from '$lib/server/support';

export const load: PageServerLoad = async ({ locals, url }) => {
	const profile = await requireCustomer(locals, url.pathname);
	return { threads: await listCustomerThreads(profile.id) };
};

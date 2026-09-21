import type { PageServerLoad } from './$types';
import { requireCustomer } from '../guard';
import { listCustomerRepairs } from '$lib/server/repairs';

export const load: PageServerLoad = async ({ locals, url }) => {
	const profile = await requireCustomer(locals, url.pathname);
	return { repairs: await listCustomerRepairs(profile.id) };
};

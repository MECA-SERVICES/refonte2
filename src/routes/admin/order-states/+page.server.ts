import type { PageServerLoad } from './$types';
import { listOrderStates } from '$lib/server/orders';

export const load: PageServerLoad = async () => {
	const rows = await listOrderStates();
	return { rows };
};

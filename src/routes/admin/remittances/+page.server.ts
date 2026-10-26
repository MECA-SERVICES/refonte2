import type { PageServerLoad } from './$types';
import { listRemittances, pendingRemittanceTotals } from '$lib/server/settlements';

export const load: PageServerLoad = async () => {
	const [remittances, pending] = await Promise.all([listRemittances(), pendingRemittanceTotals()]);
	return { remittances, pending };
};

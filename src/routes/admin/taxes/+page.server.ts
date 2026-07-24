import type { PageServerLoad } from './$types';
import { listTaxRules } from '$lib/server/catalog';

export const load: PageServerLoad = async () => {
	const rows = await listTaxRules();
	return { rows };
};

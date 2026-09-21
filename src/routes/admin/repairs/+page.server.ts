import type { PageServerLoad } from './$types';
import { countByStatus, listRepairOrders } from '$lib/server/repairs';
import type { RepairStatus } from '$lib/server/db/repair.schema';
import { repairStatuses } from '$lib/server/db/repair.schema';

export const load: PageServerLoad = async ({ url }) => {
	const statusParam = url.searchParams.get('etat');
	const status = (
		statusParam && repairStatuses.includes(statusParam as RepairStatus) ? statusParam : 'all'
	) as RepairStatus | 'all';

	const search = url.searchParams.get('q') ?? '';
	const page = Number(url.searchParams.get('page') ?? '1') || 1;

	const [list, counts] = await Promise.all([
		listRepairOrders({ status, search, page }),
		countByStatus()
	]);

	return { ...list, counts, status, search };
};

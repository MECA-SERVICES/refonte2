import type { PageServerLoad } from './$types';
import {
	listStaffUsers,
	listSupportCategories,
	listSupportThreads,
	SUPPORT_QUEUES,
	type SupportQueue
} from '$lib/server/support';
import { SUPPORT_PRIORITIES, type SupportPriority } from '$lib/server/db/support.schema';

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams;

	const queueParam = q.get('queue') ?? 'todo';
	const queue: SupportQueue = (SUPPORT_QUEUES as readonly string[]).includes(queueParam)
		? (queueParam as SupportQueue)
		: 'todo';

	const priorityParam = q.get('priority');
	const priority = (SUPPORT_PRIORITIES as readonly string[]).includes(priorityParam ?? '')
		? (priorityParam as SupportPriority)
		: undefined;

	// « me » désigne l'opérateur connecté : le lien reste valable pour chacun.
	const assignedParam = q.get('assigned') ?? '';
	const assigned = assignedParam === 'me' ? locals.user?.id : assignedParam || undefined;

	const params = {
		queue,
		search: q.get('q')?.trim() || undefined,
		categoryId: Number(q.get('category')) || undefined,
		priority,
		assigned,
		customerId: Number(q.get('customer')) || undefined,
		orderId: Number(q.get('order')) || undefined,
		sort: q.get('sort') ?? undefined,
		dir: q.get('dir') === 'asc' ? ('asc' as const) : undefined,
		page: Number(q.get('page') ?? '1') || 1
	};

	const [result, categories, staff] = await Promise.all([
		listSupportThreads(params),
		listSupportCategories(),
		listStaffUsers()
	]);

	return {
		...result,
		search: params.search ?? '',
		categoryId: params.categoryId ? String(params.categoryId) : '',
		priority: priority ?? '',
		assigned: assignedParam,
		customerId: params.customerId ? String(params.customerId) : '',
		orderId: params.orderId ? String(params.orderId) : '',
		categories: categories.map((c) => ({ id: c.id, label: c.label, isActive: c.isActive })),
		staff
	};
};

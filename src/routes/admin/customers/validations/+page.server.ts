import type { PageServerLoad } from './$types';
import { countByStatus, listValidationRequests } from '$lib/server/account-validation';
import {
	CUSTOMER_STATUSES,
	VALIDATION_REQUEST_TYPES,
	type CustomerStatus,
	type ValidationRequestType
} from '$lib/accounts';

export const load: PageServerLoad = async ({ url }) => {
	const statusParam = url.searchParams.get('etat');
	const status = (
		statusParam && (CUSTOMER_STATUSES as readonly string[]).includes(statusParam)
			? statusParam
			: 'pending'
	) as CustomerStatus;

	const typeParam = url.searchParams.get('type');
	const requestType =
		typeParam && (VALIDATION_REQUEST_TYPES as readonly string[]).includes(typeParam)
			? (typeParam as ValidationRequestType)
			: undefined;

	const search = url.searchParams.get('q') ?? '';
	const page = Number(url.searchParams.get('page') ?? '1') || 1;

	const [list, counts] = await Promise.all([
		listValidationRequests({ status, requestType, search, page }),
		countByStatus()
	]);

	return { ...list, counts, status, requestType, search };
};

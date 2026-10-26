import type { PageServerLoad } from './$types';
import {
	isMissingPriceScope,
	listMissingPrice,
	MISSING_PRICE_PER_PAGE,
	MISSING_PRICE_SCOPES,
	missingPriceCounts
} from '$lib/server/purchase-price-report';

export const load: PageServerLoad = async ({ url }) => {
	const param = url.searchParams.get('perimetre');
	const scope = isMissingPriceScope(param) ? param : 'stock';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const [rows, counts] = await Promise.all([listMissingPrice(scope, page), missingPriceCounts()]);
	return {
		scope,
		page,
		rows,
		counts,
		scopes: Object.entries(MISSING_PRICE_SCOPES) as [keyof typeof MISSING_PRICE_SCOPES, string][],
		perPage: MISSING_PRICE_PER_PAGE
	};
};

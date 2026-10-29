import type { PageServerLoad } from './$types';
import { listQuotes, quoteSummary, type QuoteListFilter } from '$lib/server/quotes';

const FILTERS: QuoteListFilter[] = ['all', 'draft', 'open', 'accepted', 'invoiced', 'lost'];

/** `?f=` : onglet (brouillons, en cours…) ; `?q=` : n° ou client. */
export const load: PageServerLoad = async ({ url }) => {
	const f = url.searchParams.get('f') as QuoteListFilter;
	const filter = FILTERS.includes(f) ? f : 'all';
	const q = url.searchParams.get('q')?.trim() ?? '';
	const [quotes, summary] = await Promise.all([listQuotes(filter, q), quoteSummary()]);
	return { filter, q, quotes, summary };
};

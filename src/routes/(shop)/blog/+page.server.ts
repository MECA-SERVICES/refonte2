import type { PageServerLoad } from './$types';
import { listPublicCategories, listPublishedArticles } from '$lib/server/blog';

export const load: PageServerLoad = async () => ({
	articles: await listPublishedArticles(),
	categories: await listPublicCategories()
});

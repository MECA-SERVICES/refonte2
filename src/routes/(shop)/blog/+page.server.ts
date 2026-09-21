import type { PageServerLoad } from './$types';
import { descendantIds, listPublicCategories, listPublishedArticles } from '$lib/server/blog';

export const load: PageServerLoad = async () => {
	const categories = await listPublicCategories();

	return {
		articles: await listPublishedArticles(),
		categories,
		/*
		 * Navigation de premier niveau, chaque entrée portant le total de sa
		 * branche : un parent dont les articles sont tous rangés dans ses
		 * sous-catégories afficherait autrement « 0 ».
		 */
		roots: categories
			.filter((c) => c.parentId === null)
			.map((c) => {
				const branch = new Set(descendantIds(categories, c.id));
				return {
					...c,
					branchCount: categories
						.filter((x) => branch.has(x.id))
						.reduce((sum, x) => sum + x.articleCount, 0)
				};
			})
	};
};

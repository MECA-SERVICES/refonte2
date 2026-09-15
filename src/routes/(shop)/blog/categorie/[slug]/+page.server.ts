import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listPublicCategories, listPublishedArticles } from '$lib/server/blog';

export const load: PageServerLoad = async ({ params }) => {
	const categories = await listPublicCategories();
	const current = categories.find((c) => c.slug === params.slug);
	// Une catégorie masquée sort de la navigation (R14) : sa page n'existe plus.
	if (!current) error(404, 'Catégorie introuvable');

	return {
		articles: await listPublishedArticles(params.slug),
		categories,
		current
	};
};

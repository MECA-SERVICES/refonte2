import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	ancestorsOf,
	descendantIds,
	listPublicCategories,
	listPublishedArticles
} from '$lib/server/blog';

export const load: PageServerLoad = async ({ params }) => {
	const categories = await listPublicCategories();
	const current = categories.find((c) => c.slug === params.slug);
	// Une catégorie masquée sort de la navigation (R14) : sa page n'existe plus.
	if (!current) error(404, 'Catégorie introuvable');

	// La page couvre la catégorie et sa descendance : ouvrir un thème montre
	// aussi ce qui est rangé dans ses sous-catégories.
	const branch = descendantIds(categories, current.id);

	return {
		articles: await listPublishedArticles(undefined, branch),
		categories,
		current,
		/** Ancêtres inclus, de la racine à la catégorie — fil d'Ariane. */
		trail: ancestorsOf(categories, current),
		children: categories.filter((c) => c.parentId === current.id),
		/** Catégories de premier niveau, pour la navigation principale. */
		roots: categories.filter((c) => c.parentId === null)
	};
};

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShopCategory, loadShopListing } from '$lib/server/shop';
import { sanitizeHtml } from '$lib/server/sanitize';

export const load: PageServerLoad = async ({ params, url }) => {
	const category = await getShopCategory(params.slug);
	if (!category) error(404, 'Catégorie introuvable');

	const listing = await loadShopListing(url, { categoryIds: category.subtreeIds });

	return {
		category: {
			id: category.id,
			name: category.name,
			slug: category.slug,
			description: sanitizeHtml(category.description)
		},
		breadcrumb: category.breadcrumb.map((c) => ({ name: c.name, slug: c.slug })),
		children: category.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
		...listing
	};
};

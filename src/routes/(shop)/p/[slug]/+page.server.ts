import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublishedPage } from '$lib/server/cms';
import { sanitizeHtml } from '$lib/server/sanitize';

export const load: PageServerLoad = async ({ params }) => {
	const page = await getPublishedPage(params.slug);
	// Un brouillon répond comme une page absente : son existence ne doit pas
	// transparaître côté public.
	if (!page) error(404, 'Page introuvable');

	return {
		page: {
			title: page.title,
			// Le contenu vient de l'éditeur : il est rendu via `{@html}`, donc
			// assaini avant d'être transmis au navigateur.
			content: sanitizeHtml(page.content),
			metaTitle: page.metaTitle,
			metaDescription: page.metaDescription,
			updatedAt: page.updatedAt
		}
	};
};

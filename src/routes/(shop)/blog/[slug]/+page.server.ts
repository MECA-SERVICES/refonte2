import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublicArticle, recordArticleView } from '$lib/server/blog';
import { sanitizeHtml } from '$lib/server/sanitize';

export const load: PageServerLoad = async ({ params, url }) => {
	const found = await getPublicArticle(params.slug, url.searchParams.get('apercu') ?? undefined);
	// Un brouillon sans jeton valide répond comme un article absent.
	if (!found) error(404, 'Article introuvable');

	const { article } = found;

	// Un article de type lien externe n'a pas de page propre : il renvoie.
	if (article.contentType === 'external_link' && article.externalUrl) {
		redirect(307, article.externalUrl);
	}

	// Le compteur ne suit que les consultations publiques : un aperçu de
	// brouillon relu dix fois fausserait la mesure (R17).
	if (!found.isPreview) await recordArticleView(article.id);

	return {
		article: {
			title: article.title,
			contentType: article.contentType,
			content: sanitizeHtml(article.content),
			videoUrl: article.videoUrl,
			coverImageUrl: article.coverImageUrl,
			excerpt: article.excerpt,
			metaTitle: article.metaTitle,
			metaDescription: article.metaDescription,
			publishedAt: article.publishedAt,
			viewCount: article.viewCount
		},
		categoryName: found.categoryName,
		categorySlug: found.categorySlug,
		authorName: found.authorName,
		isPreview: found.isPreview
	};
};

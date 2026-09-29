import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublicArticle, listPublishedArticles, recordArticleView } from '$lib/server/blog';
import { sanitizeHtml } from '$lib/server/sanitize';

/** Nombre d'articles proposés dans la colonne « Articles similaires ». */
const RELATED_COUNT = 3;

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

	// Articles similaires : la même branche de catégorie d'abord, les plus
	// récents en complément si elle ne suffit pas.
	const sameCategory = found.categorySlug ? await listPublishedArticles(found.categorySlug) : [];
	const related = sameCategory.filter((a) => a.slug !== params.slug).slice(0, RELATED_COUNT);
	if (related.length < RELATED_COUNT) {
		const latest = await listPublishedArticles();
		for (const candidate of latest) {
			if (related.length >= RELATED_COUNT) break;
			if (candidate.slug === params.slug) continue;
			if (related.some((a) => a.slug === candidate.slug)) continue;
			related.push(candidate);
		}
	}

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
		isPreview: found.isPreview,
		related: related.map((a) => ({
			slug: a.slug,
			title: a.title,
			coverImageUrl: a.coverImageUrl,
			contentType: a.contentType,
			externalUrl: a.externalUrl,
			categoryName: a.categoryName
		}))
	};
};

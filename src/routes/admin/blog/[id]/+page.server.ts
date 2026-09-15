import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	deleteBlogArticle,
	getBlogArticle,
	issuePreviewToken,
	listBlogCategories,
	parseArticleForm,
	revokePreviewToken,
	updateBlogArticle
} from '$lib/server/blog';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Article introuvable');

	const article = await getBlogArticle(id);
	if (!article) error(404, 'Article introuvable');

	return { article, categories: await listBlogCategories() };
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) error(404, 'Article introuvable');

		const parsed = parseArticleForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const updated = await updateBlogArticle(id, parsed.values);
		if (!updated) return fail(404, { message: 'Article introuvable.' });

		return { saved: true };
	},

	/** Émet un lien d'aperçu ; réémettre révoque le précédent (R12). */
	preview: async ({ params }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) error(404, 'Article introuvable');

		const { token, expiresAt } = await issuePreviewToken(id);
		return { previewToken: token, previewExpiresAt: expiresAt.toISOString() };
	},

	revokePreview: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await revokePreviewToken(id);
		return { previewRevoked: true };
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await deleteBlogArticle(id);
		redirect(303, '/admin/blog');
	}
};

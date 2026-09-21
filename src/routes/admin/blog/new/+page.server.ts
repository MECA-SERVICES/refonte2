import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createBlogArticle, listBlogCategoryTree, parseArticleForm } from '$lib/server/blog';

export const load: PageServerLoad = async () => ({ categories: await listBlogCategoryTree() });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const parsed = parseArticleForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const created = await createBlogArticle({
			...parsed.values,
			// À défaut de choix explicite, l'auteur est le rédacteur connecté (R5).
			authorUserId: parsed.values.authorUserId ?? locals.user?.id ?? null,
			publishedAt: parsed.values.status === 'published' ? new Date() : null
		});
		redirect(303, `/admin/blog/${created.id}`);
	}
};

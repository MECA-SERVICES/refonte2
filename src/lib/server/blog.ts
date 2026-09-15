/**
 * Blog éditorial — CDC section 33.
 */

import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import {
	blogArticle,
	blogCategory,
	type BlogContentType,
	type BlogStatus,
	type NewBlogArticle,
	type NewBlogCategory
} from './db/blog.schema';
import { user } from './db/auth.schema';
import { slugify } from './slug';

/** Durée de validité d'un lien d'aperçu (R10). */
const PREVIEW_TOKEN_DAYS = 7;

// ===========================================================================
// Catégories
// ===========================================================================

export function listBlogCategories() {
	return db
		.select()
		.from(blogCategory)
		.orderBy(asc(blogCategory.sortOrder), asc(blogCategory.name));
}

/** Catégories visibles, avec le nombre d'articles publiés (R14). */
export function listPublicCategories() {
	return db
		.select({
			id: blogCategory.id,
			name: blogCategory.name,
			slug: blogCategory.slug,
			color: blogCategory.color,
			articleCount: sql<number>`(
				SELECT count(*)::int FROM ${blogArticle} a
				WHERE a.blog_category_id = ${blogCategory.id} AND a.status = 'published'
			)`
		})
		.from(blogCategory)
		.where(eq(blogCategory.isActive, true))
		.orderBy(asc(blogCategory.sortOrder), asc(blogCategory.name));
}

export async function getBlogCategory(id: number) {
	const [row] = await db.select().from(blogCategory).where(eq(blogCategory.id, id)).limit(1);
	return row;
}

export async function createBlogCategory(
	values: Omit<NewBlogCategory, 'slug'> & { slug?: string }
) {
	const slug = await uniqueSlug(blogCategory, values.slug || values.name);
	const [row] = await db
		.insert(blogCategory)
		.values({ ...values, slug })
		.returning();
	return row;
}

export async function updateBlogCategory(id: number, values: Partial<NewBlogCategory>) {
	const slug =
		values.slug === undefined ? undefined : await uniqueSlug(blogCategory, values.slug, id);
	const [row] = await db
		.update(blogCategory)
		.set({ ...values, ...(slug ? { slug } : {}), updatedAt: new Date() })
		.where(eq(blogCategory.id, id))
		.returning();
	return row;
}

/**
 * Supprime une catégorie vide.
 *
 * Une catégorie portant des articles est conservée (R15) : la clé étrangère
 * l'interdit déjà, mais un message clair vaut mieux qu'une erreur de base.
 */
export async function deleteBlogCategory(id: number): Promise<{ ok: boolean; reason?: string }> {
	const [used] = await db
		.select({ id: blogArticle.id })
		.from(blogArticle)
		.where(eq(blogArticle.blogCategoryId, id))
		.limit(1);

	if (used) return { ok: false, reason: 'Cette catégorie contient des articles.' };

	await db.delete(blogCategory).where(eq(blogCategory.id, id));
	return { ok: true };
}

// ===========================================================================
// Articles
// ===========================================================================

/** Tous les articles, quel que soit leur état — back-office. */
export function listBlogArticles() {
	return db
		.select({
			id: blogArticle.id,
			slug: blogArticle.slug,
			title: blogArticle.title,
			status: blogArticle.status,
			contentType: blogArticle.contentType,
			publishedAt: blogArticle.publishedAt,
			viewCount: blogArticle.viewCount,
			updatedAt: blogArticle.updatedAt,
			categoryName: blogCategory.name,
			categoryColor: blogCategory.color,
			authorName: user.name
		})
		.from(blogArticle)
		.leftJoin(blogCategory, eq(blogArticle.blogCategoryId, blogCategory.id))
		.leftJoin(user, eq(blogArticle.authorUserId, user.id))
		.orderBy(desc(blogArticle.updatedAt));
}

/** Articles publiés, éventuellement restreints à une catégorie (R19). */
export function listPublishedArticles(categorySlug?: string) {
	const conditions = [eq(blogArticle.status, 'published')];
	if (categorySlug) conditions.push(eq(blogCategory.slug, categorySlug));

	return db
		.select({
			slug: blogArticle.slug,
			title: blogArticle.title,
			excerpt: blogArticle.excerpt,
			coverImageUrl: blogArticle.coverImageUrl,
			contentType: blogArticle.contentType,
			externalUrl: blogArticle.externalUrl,
			publishedAt: blogArticle.publishedAt,
			categoryName: blogCategory.name,
			categorySlug: blogCategory.slug,
			categoryColor: blogCategory.color,
			authorName: user.name
		})
		.from(blogArticle)
		.leftJoin(blogCategory, eq(blogArticle.blogCategoryId, blogCategory.id))
		.leftJoin(user, eq(blogArticle.authorUserId, user.id))
		.where(and(...conditions))
		.orderBy(desc(blogArticle.publishedAt));
}

export async function getBlogArticle(id: number) {
	const [row] = await db.select().from(blogArticle).where(eq(blogArticle.id, id)).limit(1);
	return row;
}

/**
 * Article destiné à l'affichage public.
 *
 * Un brouillon n'est servi que sur présentation d'un jeton valide et rattaché à
 * cet article (R9, R11) ; sinon la page se comporte comme si l'article
 * n'existait pas.
 */
export async function getPublicArticle(slug: string, previewToken?: string) {
	const [row] = await db
		.select({
			article: blogArticle,
			categoryName: blogCategory.name,
			categorySlug: blogCategory.slug,
			categoryColor: blogCategory.color,
			authorName: user.name
		})
		.from(blogArticle)
		.leftJoin(blogCategory, eq(blogArticle.blogCategoryId, blogCategory.id))
		.leftJoin(user, eq(blogArticle.authorUserId, user.id))
		.where(eq(blogArticle.slug, slug))
		.limit(1);

	if (!row) return undefined;

	if (row.article.status === 'published') return { ...row, isPreview: false };

	const expiry = row.article.previewTokenExpiresAt;
	const tokenValid =
		Boolean(previewToken) &&
		previewToken === row.article.previewToken &&
		Boolean(expiry) &&
		expiry!.getTime() > Date.now();

	return tokenValid ? { ...row, isPreview: true } : undefined;
}

/** Incrémente le compteur de consultations (R17). */
export async function recordArticleView(id: number) {
	await db
		.update(blogArticle)
		.set({ viewCount: sql`${blogArticle.viewCount} + 1` })
		.where(eq(blogArticle.id, id));
}

export async function createBlogArticle(values: Omit<NewBlogArticle, 'slug'> & { slug?: string }) {
	const slug = await uniqueSlug(blogArticle, values.slug || values.title);
	const [row] = await db
		.insert(blogArticle)
		.values({ ...values, slug })
		.returning();
	return row;
}

export async function updateBlogArticle(id: number, values: Partial<NewBlogArticle>) {
	const current = await getBlogArticle(id);
	if (!current) return undefined;

	const slug =
		values.slug === undefined ? undefined : await uniqueSlug(blogArticle, values.slug, id);

	// La date de mise en ligne est figée au premier passage en publication (R4) :
	// une modification ultérieure ne doit pas la repousser.
	const publishedAt =
		values.status === 'published' && !current.publishedAt ? new Date() : current.publishedAt;

	const [row] = await db
		.update(blogArticle)
		.set({ ...values, ...(slug ? { slug } : {}), publishedAt, updatedAt: new Date() })
		.where(eq(blogArticle.id, id))
		.returning();
	return row;
}

export async function deleteBlogArticle(id: number) {
	await db.delete(blogArticle).where(eq(blogArticle.id, id));
}

/**
 * Émet un jeton d'aperçu, remplaçant le précédent (R12).
 *
 * Réémettre vaut donc révocation : l'ancien lien cesse aussitôt de fonctionner.
 */
export async function issuePreviewToken(id: number) {
	const token = randomBytes(24).toString('base64url');
	const expiresAt = new Date(Date.now() + PREVIEW_TOKEN_DAYS * 86_400_000);

	await db
		.update(blogArticle)
		.set({ previewToken: token, previewTokenExpiresAt: expiresAt, updatedAt: new Date() })
		.where(eq(blogArticle.id, id));

	return { token, expiresAt };
}

export async function revokePreviewToken(id: number) {
	await db
		.update(blogArticle)
		.set({ previewToken: null, previewTokenExpiresAt: null, updatedAt: new Date() })
		.where(eq(blogArticle.id, id));
}

/** Comptes internes pouvant être désignés comme auteur (R5). */
export function listAuthors() {
	return db
		.select({ id: user.id, name: user.name })
		.from(user)
		.where(isNotNull(user.role))
		.orderBy(asc(user.name));
}

// ===========================================================================
// Utilitaires
// ===========================================================================

/**
 * Rend un slug unique dans sa table.
 *
 * L'index unique rejetterait le doublon ; mieux vaut suffixer que renvoyer une
 * erreur de base à l'utilisateur.
 */
async function uniqueSlug(
	table: typeof blogArticle | typeof blogCategory,
	base: string,
	exceptId?: number
): Promise<string> {
	const root = slugify(base) || 'article';

	for (let suffix = 0; ; suffix++) {
		const candidate = suffix === 0 ? root : `${root}-${suffix + 1}`;
		const [taken] = await db
			.select({ id: table.id })
			.from(table)
			.where(
				exceptId
					? and(eq(table.slug, candidate), sql`${table.id} <> ${exceptId}`)
					: eq(table.slug, candidate)
			)
			.limit(1);

		if (!taken) return candidate;
	}
}

/**
 * Résultat d'une analyse de formulaire.
 *
 * Union discriminée par `ok` : un simple `'values' in out` ne suffirait pas à
 * convaincre TypeScript que la valeur est définie.
 */
export type ParseResult<T> = { ok: false; error: string } | { ok: true; values: T };

/** Champs d'un article, prêts à être enregistrés. */
export type ArticleInput = {
	title: string;
	slug: string;
	contentType: BlogContentType;
	content: string;
	videoUrl: string | null;
	externalUrl: string | null;
	coverImageUrl: string | null;
	excerpt: string | null;
	metaTitle: string | null;
	metaDescription: string | null;
	blogCategoryId: number | null;
	authorUserId: string | null;
	status: BlogStatus;
};

/** Champs d'un article, extraits d'un formulaire. */
export function parseArticleForm(form: FormData): ParseResult<ArticleInput> {
	const str = (key: string) => form.get(key)?.toString().trim() || null;

	const title = str('title');
	if (!title) return { ok: false, error: 'Le titre est obligatoire.' };

	const contentType = (str('contentType') ?? 'article') as BlogContentType;
	const status = (str('status') ?? 'draft') as BlogStatus;
	const excerpt = str('excerpt');
	const videoUrl = str('videoUrl');
	const externalUrl = str('externalUrl');

	// R7 — la forme du contenu impose son adresse.
	if (contentType === 'video' && !videoUrl) {
		return { ok: false, error: 'Un article vidéo exige une adresse de vidéo.' };
	}
	if (contentType === 'external_link' && !externalUrl) {
		return { ok: false, error: 'Un lien externe exige une adresse de destination.' };
	}

	// R8 — titre, extrait et catégorie sont requis avant publication.
	const categoryId = Number(form.get('blogCategoryId')) || null;
	if (status === 'published') {
		if (!excerpt) return { ok: false, error: 'Un extrait est requis avant publication.' };
		if (!categoryId) return { ok: false, error: 'Une catégorie est requise avant publication.' };
	}

	return {
		ok: true,
		values: {
			title,
			slug: str('slug') ?? title,
			contentType,
			content: form.get('content')?.toString() ?? '',
			videoUrl,
			externalUrl,
			coverImageUrl: str('coverImageUrl'),
			excerpt,
			metaTitle: str('metaTitle'),
			metaDescription: str('metaDescription'),
			blogCategoryId: categoryId,
			authorUserId: str('authorUserId'),
			status
		}
	};
}

/** Champs d'une catégorie, prêts à être enregistrés. */
export type CategoryInput = {
	name: string;
	slug: string;
	description: string | null;
	color: string | null;
	icon: string | null;
	sortOrder: number;
	isActive: boolean;
};

/** Champs d'une catégorie, extraits d'un formulaire. */
export function parseCategoryForm(form: FormData): ParseResult<CategoryInput> {
	const str = (key: string) => form.get(key)?.toString().trim() || null;

	const name = str('name');
	if (!name) return { ok: false, error: 'Le libellé est obligatoire.' };

	return {
		ok: true,
		values: {
			name,
			slug: str('slug') ?? name,
			description: str('description'),
			color: str('color'),
			icon: str('icon'),
			sortOrder: Number(form.get('sortOrder')) || 0,
			isActive: form.get('isActive') != null
		}
	};
}

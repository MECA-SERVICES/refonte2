/**
 * Blog éditorial — CDC section 33.
 */

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
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
<<<<<<< HEAD
import { formFields, type ParseResult } from './forms';
=======
import { BLOG_CATEGORY_MAX_DEPTH } from '$lib/blog';

export { BLOG_CATEGORY_MAX_DEPTH };
>>>>>>> 4d40d4f (categorie blog)

/** Durée de validité d'un lien d'aperçu (R10). */
const PREVIEW_TOKEN_DAYS = 7;

// ===========================================================================
// Catégories
// ===========================================================================

/** Forme minimale exploitable par les parcours d'arborescence. */
type TreeNode = { id: number; parentId: number | null };

/**
 * Ids d'une catégorie et de toute sa descendance.
 *
 * Parcours en mémoire — l'arbre du blog reste petit, et le catalogue produit
 * traite déjà ses 600 entrées de la même façon (`shop.ts`). Le marquage des
 * visités protège des cycles qu'un enregistrement ancien aurait pu laisser.
 */
export function descendantIds<T extends TreeNode>(all: T[], rootId: number): number[] {
	const ids = [rootId];
	const seen = new Set([rootId]);

	for (let i = 0; i < ids.length; i++) {
		for (const c of all) {
			if (c.parentId === ids[i] && !seen.has(c.id)) {
				seen.add(c.id);
				ids.push(c.id);
			}
		}
	}
	return ids;
}

/** Chaîne des ancêtres, de la racine vers la catégorie — fil d'Ariane. */
export function ancestorsOf<T extends TreeNode>(all: T[], leaf: T): T[] {
	const byId = new Map(all.map((c) => [c.id, c]));
	const chain: T[] = [];
	let current: T | undefined = leaf;

	// La borne vaut garde-fou : un cycle résiduel arrêterait la remontée.
	while (current && chain.length < BLOG_CATEGORY_MAX_DEPTH) {
		chain.unshift(current);
		current = current.parentId != null ? byId.get(current.parentId) : undefined;
	}
	return chain;
}

/** Profondeur d'une catégorie : 1 pour une racine. */
function depthOf<T extends TreeNode>(all: T[], node: T): number {
	return ancestorsOf(all, node).length;
}

/**
 * Hauteur du sous-arbre porté par une catégorie : 1 si elle n'a pas d'enfant.
 *
 * Sert à refuser un rattachement qui pousserait une descendance existante
 * au-delà de la profondeur permise.
 */
function subtreeHeight<T extends TreeNode>(all: T[], rootId: number): number {
	const children = all.filter((c) => c.parentId === rootId);
	if (children.length === 0) return 1;

	let tallest = 0;
	for (const child of children) {
		// `descendantIds` a déjà écarté les cycles ; la borne évite une récursion
		// sans fin sur une donnée incohérente.
		if (child.id === rootId) continue;
		tallest = Math.max(tallest, subtreeHeight(all, child.id));
	}
	return tallest + 1;
}

export function listBlogCategories() {
	return db
		.select()
		.from(blogCategory)
		.orderBy(asc(blogCategory.sortOrder), asc(blogCategory.name));
}

type BlogCategoryRow = Awaited<ReturnType<typeof listBlogCategories>>[number];

/**
 * Catégories ordonnées en arbre : chaque parent précède ses enfants, chaque
 * ligne portant sa profondeur. L'admin s'en sert pour l'indentation.
 */
export async function listBlogCategoryTree() {
	const rows = await listBlogCategories();

	const walk = (
		parentId: number | null,
		depth: number
	): (BlogCategoryRow & {
		depth: number;
	})[] =>
		rows
			.filter((c) => c.parentId === parentId)
			.flatMap((c) => [{ ...c, depth }, ...walk(c.id, depth + 1)]);

	const tree = walk(null, 1);

	// Filet de sécurité : une catégorie orpheline (parent supprimé hors
	// application) resterait invisible sans cela.
	const placed = new Set(tree.map((c) => c.id));
	return [...tree, ...rows.filter((c) => !placed.has(c.id)).map((c) => ({ ...c, depth: 1 }))];
}

/**
 * Valide un rattachement (R16 étendu) : pas de boucle sur soi, pas de
 * descendant pour parent, et trois niveaux au maximum.
 *
 * Retourne `null` si le rattachement est permis, sinon le motif du refus.
 */
export async function validateCategoryParent(
	parentId: number | null,
	categoryId?: number
): Promise<string | null> {
	if (parentId == null) return null;

	const rows = await db
		.select({ id: blogCategory.id, parentId: blogCategory.parentId })
		.from(blogCategory);

	const parent = rows.find((c) => c.id === parentId);
	if (!parent) return 'La catégorie parente est introuvable.';

	if (categoryId) {
		if (parentId === categoryId) return 'Une catégorie ne peut pas être sa propre parente.';

		// Rattacher à sa propre descendance détacherait le sous-arbre du reste.
		if (descendantIds(rows, categoryId).includes(parentId)) {
			return 'Une catégorie ne peut pas être rattachée à l’une de ses sous-catégories.';
		}
	}

	const parentDepth = depthOf(rows, parent);
	// Une catégorie déjà pourvue d'enfants emmène tout son sous-arbre avec elle.
	const height = categoryId ? subtreeHeight(rows, categoryId) : 1;

	if (parentDepth + height > BLOG_CATEGORY_MAX_DEPTH) {
		return `L’arborescence est limitée à ${BLOG_CATEGORY_MAX_DEPTH} niveaux.`;
	}
	return null;
}

/** Catégories visibles, avec le nombre d'articles publiés (R14). */
export function listPublicCategories() {
	return db
		.select({
			id: blogCategory.id,
			parentId: blogCategory.parentId,
			name: blogCategory.name,
			slug: blogCategory.slug,
			description: blogCategory.description,
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

/**
 * Articles publiés, éventuellement restreints à une catégorie (R19).
 *
 * La restriction couvre la catégorie **et toute sa descendance** : ouvrir un
 * thème montre aussi ce qui est rangé dans ses sous-catégories. `categoryIds`
 * permet à l'appelant qui a déjà l'arbre en main d'éviter une relecture.
 */
export async function listPublishedArticles(categorySlug?: string, categoryIds?: number[]) {
	const conditions = [eq(blogArticle.status, 'published')];

	if (categoryIds) {
		// Une catégorie sans article ni descendance ne doit rien remonter.
		if (categoryIds.length === 0) return [];
		conditions.push(inArray(blogArticle.blogCategoryId, categoryIds));
	} else if (categorySlug) {
		const rows = await db
			.select({ id: blogCategory.id, parentId: blogCategory.parentId, slug: blogCategory.slug })
			.from(blogCategory);

		const root = rows.find((c) => c.slug === categorySlug);
		if (!root) return [];
		conditions.push(inArray(blogArticle.blogCategoryId, descendantIds(rows, root.id)));
	}

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
	const { str } = formFields(form);

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
	parentId: number | null;
	description: string | null;
	color: string | null;
	icon: string | null;
	sortOrder: number;
	isActive: boolean;
};

/** Champs d'une catégorie, extraits d'un formulaire. */
export function parseCategoryForm(form: FormData): ParseResult<CategoryInput> {
	const { str, int, bool } = formFields(form);

	const name = str('name');
	if (!name) return { ok: false, error: 'Le libellé est obligatoire.' };

	// Une valeur vide vaut « à la racine » ; la cohérence du rattachement est
	// vérifiée séparément par `validateCategoryParent`, qui lit la base.
	const parentRaw = Number(form.get('parentId'));
	const parentId = Number.isInteger(parentRaw) && parentRaw > 0 ? parentRaw : null;

	return {
		ok: true,
		values: {
			name,
			slug: str('slug') ?? name,
			parentId,
			description: str('description'),
			color: str('color'),
			icon: str('icon'),
			sortOrder: int('sortOrder'),
			isActive: bool('isActive')
		}
	};
}

/**
 * Pages éditoriales : lecture publique et gestion en back-office.
 */

import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from './db';
import { cmsPage, type NewCmsPage } from './db/cms.schema';
import { slugify } from './slug';
import { formFields, type ParseResult } from './forms';

/** Toutes les pages, publiées ou non — back-office. */
export function listCmsPages() {
	return db.select().from(cmsPage).orderBy(asc(cmsPage.title));
}

/** Pages publiées, pour le pied de page et le plan du site. */
export function listPublishedPages() {
	return db
		.select({ slug: cmsPage.slug, title: cmsPage.title })
		.from(cmsPage)
		.where(eq(cmsPage.isPublished, true))
		.orderBy(asc(cmsPage.title));
}

export async function getCmsPage(id: number) {
	const [row] = await db.select().from(cmsPage).where(eq(cmsPage.id, id)).limit(1);
	return row;
}

/** Page publiée correspondant à une adresse — `undefined` si brouillon ou absente. */
export async function getPublishedPage(slug: string) {
	const [row] = await db
		.select()
		.from(cmsPage)
		.where(and(eq(cmsPage.slug, slug), eq(cmsPage.isPublished, true)))
		.limit(1);
	return row;
}

/**
 * Rend un slug unique en le suffixant si besoin.
 *
 * L'index unique rejetterait le doublon ; mieux vaut proposer une adresse
 * valable que renvoyer une erreur de base à l'utilisateur.
 */
async function uniqueSlug(base: string, exceptId?: number): Promise<string> {
	const root = slugify(base) || 'page';

	for (let suffix = 0; ; suffix++) {
		const candidate = suffix === 0 ? root : `${root}-${suffix + 1}`;
		const [taken] = await db
			.select({ id: cmsPage.id })
			.from(cmsPage)
			.where(
				exceptId
					? and(eq(cmsPage.slug, candidate), ne(cmsPage.id, exceptId))
					: eq(cmsPage.slug, candidate)
			)
			.limit(1);

		if (!taken) return candidate;
	}
}

export async function createCmsPage(values: Omit<NewCmsPage, 'slug'> & { slug?: string }) {
	const slug = await uniqueSlug(values.slug || values.title);
	const [row] = await db
		.insert(cmsPage)
		.values({ ...values, slug })
		.returning();
	return row;
}

export async function updateCmsPage(
	id: number,
	values: Partial<NewCmsPage>
): Promise<typeof cmsPage.$inferSelect | undefined> {
	const slug = values.slug === undefined ? undefined : await uniqueSlug(values.slug, id);

	const [row] = await db
		.update(cmsPage)
		.set({ ...values, ...(slug ? { slug } : {}), updatedAt: new Date() })
		.where(eq(cmsPage.id, id))
		.returning();
	return row;
}

export async function deleteCmsPage(id: number) {
	await db.delete(cmsPage).where(eq(cmsPage.id, id));
}

/** Champs saisissables d'une page éditoriale. */
export type CmsPageInput = {
	title: string;
	slug: string;
	content: string;
	isPublished: boolean;
	metaTitle: string | null;
	metaDescription: string | null;
};

/** Champs d'une page, extraits d'un formulaire. */
export function parseCmsPageForm(form: FormData): ParseResult<CmsPageInput> {
	const { str, bool } = formFields(form);

	const title = str('title');
	if (!title) return { ok: false, error: 'Le titre est obligatoire.' };

	return {
		ok: true,
		values: {
			title,
			// Vide, le slug sera dérivé du titre par `uniqueSlug`.
			slug: str('slug') ?? title,
			content: form.get('content')?.toString() ?? '',
			isPublished: bool('isPublished'),
			metaTitle: str('metaTitle'),
			metaDescription: str('metaDescription')
		}
	};
}

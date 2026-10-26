/**
 * Page d'accueil réglable en back-office (demandes client 10.1, 10.3, 10.4).
 *
 * Lecture pour la boutique, écriture pour l'écran « Apparence › Page
 * d'accueil ». Sans réglage, chaque bloc laisse place au bloc automatique
 * qu'il remplace.
 */
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { category, product } from '$lib/server/db/catalog.schema';
import {
	homeFeaturedCategory,
	homeFeaturedProduct,
	homePromoTile,
	homeSetting,
	homeTileTones,
	type HomeTileTone
} from '$lib/server/db/home.schema';
import { formFields, type ParseResult } from '$lib/server/forms';
import { shopProductCardsByIds } from '$lib/server/shop';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class HomeError extends Error {}

/** Clés des réglages simples de l'accueil. */
export const HOME_SETTINGS = {
	featuredImageUrl: 'featured.imageUrl',
	featuredImageLink: 'featured.imageLink'
} as const;

const parent = alias(category, 'parent');

// ===========================================================================
// Boutique
// ===========================================================================

/** Tout ce que l'accueil affiche de réglé en back-office. */
export async function loadHomeContent() {
	const [tiles, categories, productIds, settings] = await Promise.all([
		db
			.select()
			.from(homePromoTile)
			.where(eq(homePromoTile.isActive, true))
			.orderBy(asc(homePromoTile.position), asc(homePromoTile.id))
			.limit(4),
		db
			.select({
				id: category.id,
				name: category.name,
				slug: category.slug,
				parentName: parent.name,
				imageUrl: homeFeaturedCategory.imageUrl
			})
			.from(homeFeaturedCategory)
			.innerJoin(category, eq(category.id, homeFeaturedCategory.categoryId))
			.leftJoin(parent, eq(parent.id, category.parentId))
			.where(eq(category.isActive, true))
			.orderBy(asc(homeFeaturedCategory.position), asc(category.name)),
		db
			.select({ id: homeFeaturedProduct.productId })
			.from(homeFeaturedProduct)
			.orderBy(asc(homeFeaturedProduct.position), asc(homeFeaturedProduct.productId)),
		db.select().from(homeSetting)
	]);

	// Les cartes produit sont celles du catalogue (prix TTC, stock, vignette) ;
	// l'ordre choisi en back-office est rétabli après lecture.
	const ids = productIds.map((p) => p.id);
	const cards = await shopProductCardsByIds(ids);
	const byId = new Map(cards.map((c) => [c.id, c]));
	const products = ids.map((id) => byId.get(id)).filter((c) => c !== undefined);

	const setting = (key: string) => settings.find((s) => s.key === key)?.value || null;

	return {
		tiles,
		categories,
		products,
		featuredImageUrl: setting(HOME_SETTINGS.featuredImageUrl),
		featuredImageLink: setting(HOME_SETTINGS.featuredImageLink)
	};
}

// ===========================================================================
// Back-office
// ===========================================================================

/** Contenu de l'écran de réglage : tout, actif ou non, avec les libellés. */
export async function loadHomeAdmin() {
	const [tiles, categories, products, settings, categoryOptions] = await Promise.all([
		db.select().from(homePromoTile).orderBy(asc(homePromoTile.position), asc(homePromoTile.id)),
		db
			.select({
				categoryId: homeFeaturedCategory.categoryId,
				imageUrl: homeFeaturedCategory.imageUrl,
				position: homeFeaturedCategory.position,
				name: category.name,
				parentName: parent.name
			})
			.from(homeFeaturedCategory)
			.innerJoin(category, eq(category.id, homeFeaturedCategory.categoryId))
			.leftJoin(parent, eq(parent.id, category.parentId))
			.orderBy(asc(homeFeaturedCategory.position), asc(category.name)),
		db
			.select({
				productId: homeFeaturedProduct.productId,
				position: homeFeaturedProduct.position,
				name: product.name,
				reference: product.reference,
				isActive: product.isActive
			})
			.from(homeFeaturedProduct)
			.innerJoin(product, eq(product.id, homeFeaturedProduct.productId))
			.orderBy(asc(homeFeaturedProduct.position), asc(homeFeaturedProduct.productId)),
		db.select().from(homeSetting),
		db
			.select({ id: category.id, name: category.name, parentName: parent.name })
			.from(category)
			.leftJoin(parent, eq(parent.id, category.parentId))
			.where(and(eq(category.isActive, true), sql`${category.parentId} is not null`))
			.orderBy(asc(parent.name), asc(category.name))
	]);

	const setting = (key: string) => settings.find((s) => s.key === key)?.value ?? '';

	return {
		tiles,
		categories,
		products,
		categoryOptions,
		featuredImageUrl: setting(HOME_SETTINGS.featuredImageUrl),
		featuredImageLink: setting(HOME_SETTINGS.featuredImageLink)
	};
}

export type TileInput = {
	eyebrow: string | null;
	title: string;
	imageUrl: string | null;
	linkUrl: string;
	buttonLabel: string;
	tone: HomeTileTone;
	badge: string | null;
	position: number;
	isActive: boolean;
};

export function parseTileForm(form: FormData): ParseResult<TileInput> {
	const { str, int, bool } = formFields(form);
	const title = str('title');
	if (!title) return { ok: false, error: 'Le titre de la tuile est obligatoire.' };
	const linkUrl = str('linkUrl');
	if (!linkUrl) return { ok: false, error: 'Indiquez la page vers laquelle mène la tuile.' };
	const tone = str('tone');

	return {
		ok: true,
		values: {
			eyebrow: str('eyebrow'),
			title,
			imageUrl: str('imageUrl'),
			linkUrl,
			buttonLabel: str('buttonLabel') ?? 'Je découvre',
			tone: homeTileTones.includes(tone as HomeTileTone) ? (tone as HomeTileTone) : 'blue',
			badge: str('badge'),
			position: int('position', 0),
			isActive: bool('isActive')
		}
	};
}

export async function saveTile(id: number | null, values: TileInput) {
	if (id) await db.update(homePromoTile).set(values).where(eq(homePromoTile.id, id));
	else await db.insert(homePromoTile).values(values);
}

export async function deleteTile(id: number) {
	await db.delete(homePromoTile).where(eq(homePromoTile.id, id));
}

/** Ajoute une catégorie mise en avant, ou met à jour son visuel et sa place. */
export async function saveFeaturedCategory(
	categoryId: number,
	imageUrl: string | null,
	position: number
) {
	await db
		.insert(homeFeaturedCategory)
		.values({ categoryId, imageUrl, position })
		.onConflictDoUpdate({
			target: homeFeaturedCategory.categoryId,
			set: { imageUrl, position }
		});
}

export async function removeFeaturedCategory(categoryId: number) {
	await db.delete(homeFeaturedCategory).where(eq(homeFeaturedCategory.categoryId, categoryId));
}

/**
 * Ajoute des produits phares, désignés par leur référence ou leur identifiant
 * (un par ligne ou séparés par des virgules). Retourne ce qui n'a pas été trouvé.
 */
export async function addFeaturedProducts(raw: string): Promise<string[]> {
	const tokens = [
		...new Set(
			raw
				.split(/[\s,;]+/)
				.map((t) => t.trim())
				.filter(Boolean)
		)
	];
	if (tokens.length === 0)
		throw new HomeError('Indiquez au moins une référence ou un identifiant.');

	const ids = tokens.filter((t) => /^\d+$/.test(t)).map(Number);
	const found = await db
		.select({ id: product.id, reference: product.reference })
		.from(product)
		.where(
			and(
				eq(product.isActive, true),
				ids.length > 0
					? or(inArray(product.reference, tokens), inArray(product.id, ids))
					: inArray(product.reference, tokens)
			)
		);

	const [{ last }] = await db
		.select({ last: sql<number>`coalesce(max(${homeFeaturedProduct.position}), 0)::int` })
		.from(homeFeaturedProduct);

	// Une référence peut désigner plusieurs produits (doublons hérités) : on
	// les prend tous, la liste se corrige ensuite d'un clic.
	if (found.length > 0) {
		await db
			.insert(homeFeaturedProduct)
			.values(found.map((p, i) => ({ productId: p.id, position: last + (i + 1) * 10 })))
			.onConflictDoNothing();
	}

	return tokens.filter((t) => !found.some((p) => p.reference === t || String(p.id) === t));
}

export async function removeFeaturedProduct(productId: number) {
	await db.delete(homeFeaturedProduct).where(eq(homeFeaturedProduct.productId, productId));
}

export async function setFeaturedProductPosition(productId: number, position: number) {
	await db
		.update(homeFeaturedProduct)
		.set({ position })
		.where(eq(homeFeaturedProduct.productId, productId));
}

export async function saveHomeSetting(key: string, value: string | null) {
	await db
		.insert(homeSetting)
		.values({ key, value })
		.onConflictDoUpdate({ target: homeSetting.key, set: { value } });
}

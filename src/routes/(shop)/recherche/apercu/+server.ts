import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { brand, category, product, taxRule } from '$lib/server/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
	fuzzyCondition,
	fuzzySimilarity,
	fuzzyTokenScore,
	normalizeSearchQuery,
	searchCondition,
	searchRank
} from '$lib/server/search';
import { isBrandLogoSql, priceTtcSql, thumbnailWithBrandFallbackSql } from '$lib/server/pricing';

/**
 * Aperçu de recherche — alimente la liste déroulante des barres de recherche.
 *
 * Volontairement minimal : les meilleurs produits classés par pertinence,
 * plus les catégories et marques dont le nom correspond — taper « robot
 * tondeuse » propose d'ouvrir tout le rayon. La page /recherche reste la vue
 * complète (filtres, pagination) ; ici on répond vite, à chaque frappe.
 */
const categoryNameSql = sql`f_unaccent(lower(${category.name}))`;
const brandNameSql = sql`f_unaccent(lower(${brand.name}))`;

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const q = normalizeSearchQuery(url.searchParams.get('q') ?? '');

	// Les réponses sont partageables entre visiteurs : même saisie, même aperçu.
	setHeaders({ 'cache-control': 'public, max-age=60' });

	if (q.length < 2) return json({ products: [], categories: [], brands: [] });

	const condition = searchCondition(q);
	if (!condition) return json({ products: [], categories: [], brands: [] });

	const [products, categories, brands] = await Promise.all([
		db
			.select({
				id: product.id,
				name: product.name,
				slug: product.slug,
				reference: product.reference,
				stock: product.stock,
				priceTtc: priceTtcSql,
				brandName: brand.name,
				imageUrl: thumbnailWithBrandFallbackSql,
				imageIsBrandLogo: isBrandLogoSql
			})
			.from(product)
			.leftJoin(brand, eq(product.brandId, brand.id))
			.leftJoin(taxRule, eq(product.taxRuleId, taxRule.id))
			.where(and(eq(product.isActive, true), condition))
			.orderBy(desc(searchRank(q)), desc(product.id))
			.limit(6),
		// Rayons dont le nom correspond, mot à mot : quelques centaines de
		// lignes, la proximité orthographique s'évalue sans index dédié. On en
		// prend un peu plus que nécessaire pour dédoublonner les homonymes
		// (le catalogue repris compte des catégories au même nom).
		db
			.select({ name: category.name, slug: category.slug })
			.from(category)
			.where(and(eq(category.isActive, true), fuzzyCondition(categoryNameSql, q, 'any')))
			.orderBy(
				desc(fuzzyTokenScore(categoryNameSql, q)),
				// À score égal, le rayon au nom le plus court : « Robots de
				// tonte » avant « Accessoires robots de tonte ».
				sql`length(${category.name})`,
				desc(fuzzySimilarity(categoryNameSql, q))
			)
			.limit(8),
		db
			.select({ name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl })
			.from(brand)
			.where(fuzzyCondition(brandNameSql, q, 'any'))
			.orderBy(desc(fuzzyTokenScore(brandNameSql, q)), desc(fuzzySimilarity(brandNameSql, q)))
			.limit(3)
	]);

	const uniqueCategories = [...new Map(categories.map((c) => [c.name, c])).values()].slice(0, 3);

	return json({ products, categories: uniqueCategories, brands });
};

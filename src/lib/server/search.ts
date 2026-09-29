import { sql, type SQL } from 'drizzle-orm';
import { product } from '$lib/server/db/schema';

/**
 * Recherche produits — nom, référence, référence fournisseur, EAN13.
 *
 * Tout repose sur UNE expression SQL, indexée en trigrammes par la migration
 * 0035 (`product_search_trgm_idx`) : texte en minuscules et sans accents.
 * Deux opérateurs se partagent le travail, tous deux servis par l'index :
 *
 *   - `LIKE '%…%'`  : la sous-chaîne exacte (référence partielle, mot du nom) ;
 *   - `<%`          : la proximité orthographique (word_similarity), qui
 *                     rattrape les fautes de frappe — « tondeuze », « husquvarna ».
 *
 * Le seuil du `<%` (0,35) est posé au niveau de la base par la migration.
 */

/** Expression indexée — doit rester STRICTEMENT identique à la migration 0035. */
const searchTextSql = sql`f_unaccent(lower(
	${product.name} || ' ' || coalesce(${product.reference}, '') || ' ' ||
	coalesce(${product.supplierReference}, '') || ' ' || coalesce(${product.ean13}, '')
))`;

/** Nombre de mots retenus d'une saisie — au-delà, ils n'affinent plus rien. */
const MAX_TOKENS = 6;

/** Normalise la saisie comme l'expression indexée : minuscules, sans accents. */
export function normalizeSearchQuery(raw: string): string {
	return raw
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 100);
}

/**
 * Condition floue sur une expression SQL quelconque (déjà en minuscules sans
 * accents) : chaque mot de la saisie s'y retrouve, en sous-chaîne exacte ou
 * en voisin orthographique.
 *
 * `all` (ET entre mots) rend les requêtes longues plus précises — le bon
 * choix sur un million de produits (« husqvarna 550 xp »). `any` (OU) trouve
 * un rayon dès qu'un mot correspond — « robot tondeuse » doit proposer le
 * rayon « Robots de tonte » même si « tondeuse » n'y figure pas ; le
 * classement par proximité fait le tri ensuite.
 */
export function fuzzyCondition(
	expr: SQL,
	raw: string,
	mode: 'all' | 'any' = 'all'
): SQL | undefined {
	const q = normalizeSearchQuery(raw);
	if (q.length < 2) return undefined;

	const tokens = q.split(' ').slice(0, MAX_TOKENS);
	const perToken = tokens.map(
		(token) => sql`(${expr} LIKE ${'%' + token + '%'} OR ${token} <% ${expr})`
	);
	return sql.join(perToken, mode === 'all' ? sql` AND ` : sql` OR `);
}

/** Proximité globale avec la saisie, pour classer les correspondances floues. */
export function fuzzySimilarity(expr: SQL, raw: string): SQL<number> {
	return sql<number>`word_similarity(${normalizeSearchQuery(raw)}, ${expr})`;
}

/**
 * Score par mot : 1 point par mot présent en sous-chaîne, sa proximité
 * orthographique sinon. Classe « Robots de tonte » avant « Tracteurs
 * tondeuse » pour « robot tondeuse » : deux mots à moitié satisfaits valent
 * mieux qu'un seul mot exact.
 */
export function fuzzyTokenScore(expr: SQL, raw: string): SQL<number> {
	const tokens = normalizeSearchQuery(raw).split(' ').slice(0, MAX_TOKENS);
	const perToken = tokens.map(
		(token) =>
			sql`(CASE WHEN ${expr} LIKE ${'%' + token + '%'} THEN 1 ELSE word_similarity(${token}, ${expr}) END)`
	);
	return sql<number>`(${sql.join(perToken, sql` + `)})`;
}

/** Condition de recherche produits — nom, références et EAN indexés. */
export function searchCondition(raw: string): SQL | undefined {
	return fuzzyCondition(searchTextSql, raw);
}

/**
 * Score de pertinence, à trier en décroissant :
 *
 *   3  points — la saisie est exactement une référence ou un EAN ;
 *   1  point  — la fiche commence par la saisie ;
 *   0…1 point — proximité orthographique avec l'ensemble de la fiche.
 */
export function searchRank(raw: string): SQL<number> {
	const q = normalizeSearchQuery(raw);
	return sql<number>`(
		(CASE WHEN lower(${product.reference}) = ${q}
			OR lower(coalesce(${product.supplierReference}, '')) = ${q}
			OR coalesce(${product.ean13}, '') = ${q} THEN 3 ELSE 0 END)
		+ (CASE WHEN ${searchTextSql} LIKE ${q + '%'} THEN 1 ELSE 0 END)
		+ word_similarity(${q}, ${searchTextSql})
	)`;
}

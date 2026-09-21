/**
 * Listing générique back-office : recherche + filtres + tri + pagination.
 *
 * Extrait de catalog.ts, où il servait marques, catégories et produits ; les
 * autres domaines (clients, adresses…) utilisent le même mécanisme plutôt que
 * d'en réécrire un. Les colonnes passent TOUJOURS par une liste blanche
 * (`ColumnMaps`) : jamais de nom de colonne arbitraire venu de l'URL.
 */

import { and, asc, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export type ListParams = {
	search?: string;
	filters?: Record<string, string>;
	sort?: string;
	dir?: 'asc' | 'desc';
	page?: number;
	perPage?: number;
};

export type ColumnMaps = {
	/** Colonnes filtrables par saisie libre (« contient », recherche globale incluse). */
	text: Record<string, PgColumn>;
	/** Colonnes filtrables par égalité stricte (menus déroulants). */
	exact: Record<string, PgColumn>;
	/** Colonnes autorisées au tri. */
	sort: Record<string, PgColumn>;
	defaultSort: PgColumn;
};

/** Construit la clause WHERE à partir de la recherche globale et des filtres par colonne. */
export function buildWhere(params: ListParams, maps: ColumnMaps): SQL | undefined {
	const conditions: SQL[] = [];

	if (params.search) {
		const term = `%${params.search}%`;
		const parts = Object.values(maps.text).map((col) => ilike(col, term));
		if (parts.length) conditions.push(or(...parts)!);
	}

	for (const [key, raw] of Object.entries(params.filters ?? {})) {
		const value = raw.trim();
		if (!value) continue;
		if (maps.text[key]) conditions.push(ilike(maps.text[key], `%${value}%`));
		else if (maps.exact[key]) conditions.push(eq(maps.exact[key], value));
	}

	return conditions.length ? and(...conditions) : undefined;
}

/** Tri : colonne en liste blanche, direction bornée, défaut fourni par la carte. */
export function buildOrderBy(params: ListParams, maps: ColumnMaps) {
	const col = maps.sort[params.sort ?? ''] ?? maps.defaultSort;
	return params.dir === 'asc' ? asc(col) : desc(col);
}

/** Page et taille de page bornées, prêtes pour limit/offset. */
export function pageBounds(params: ListParams, { maxPerPage = 100, defaultPerPage = 20 } = {}) {
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(maxPerPage, Math.max(1, params.perPage ?? defaultPerPage));
	return { page, perPage, offset: (page - 1) * perPage };
}

/** Enveloppe de résultat commune à tous les listings paginés. */
export function paginated<T>(rows: T[], total: number, page: number, perPage: number) {
	return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

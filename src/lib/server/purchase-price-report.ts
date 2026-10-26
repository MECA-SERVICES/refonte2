/**
 * Rapport des produits sans prix d'achat (demande client 2.3).
 *
 * Tous les produits devraient porter un prix d'achat HT : la marge, la
 * valorisation du stock (2.4) et la comptabilité en dépendent. 78 000
 * références en sont dépourvues, surtout des pièces jamais vendues : le
 * rapport se lit par périmètre, du plus utile au plus large.
 */
import { and, asc, desc, eq, exists, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { brand, product } from '$lib/server/db/catalog.schema';
import { orderLine } from '$lib/server/db/order.schema';

export const MISSING_PRICE_SCOPES = {
	stock: 'En stock',
	sold: 'Déjà vendus',
	machine: 'Machines',
	consumable: 'Consommables',
	all: 'Tous'
} as const;
export type MissingPriceScope = keyof typeof MISSING_PRICE_SCOPES;

export function isMissingPriceScope(value: unknown): value is MissingPriceScope {
	return typeof value === 'string' && value in MISSING_PRICE_SCOPES;
}

export const MISSING_PRICE_PER_PAGE = 50;

const missingPrice = or(sql`${product.purchasePrice} is null`, eq(product.purchasePrice, '0'));

function scopeCondition(scope: MissingPriceScope): SQL | undefined {
	switch (scope) {
		case 'stock':
			return sql`${product.stock} > 0`;
		case 'sold':
			return exists(
				db
					.select({ one: sql`1` })
					.from(orderLine)
					.where(eq(orderLine.productId, product.id))
			);
		case 'machine':
		case 'consumable':
			return eq(product.type, scope);
		case 'all':
			return undefined;
	}
}

function where(scope: MissingPriceScope) {
	return and(eq(product.isActive, true), missingPrice, scopeCondition(scope));
}

/** Nombre de produits concernés, pour chaque périmètre. */
export async function missingPriceCounts(): Promise<Record<MissingPriceScope, number>> {
	const entries = await Promise.all(
		(Object.keys(MISSING_PRICE_SCOPES) as MissingPriceScope[]).map(async (scope) => {
			const [{ n }] = await db
				.select({ n: sql<number>`count(*)::int` })
				.from(product)
				.where(where(scope));
			return [scope, n] as const;
		})
	);
	return Object.fromEntries(entries) as Record<MissingPriceScope, number>;
}

function rows(scope: MissingPriceScope) {
	return db
		.select({
			id: product.id,
			reference: product.reference,
			supplierReference: product.supplierReference,
			name: product.name,
			brand: brand.name,
			type: product.type,
			stock: product.stock,
			priceHt: product.priceHt
		})
		.from(product)
		.leftJoin(brand, eq(brand.id, product.brandId))
		.where(where(scope))
		.orderBy(desc(product.stock), asc(product.reference));
}

/** Une page du rapport : les produits en stock d'abord. */
export function listMissingPrice(scope: MissingPriceScope, page: number) {
	return rows(scope)
		.limit(MISSING_PRICE_PER_PAGE)
		.offset((Math.max(1, page) - 1) * MISSING_PRICE_PER_PAGE);
}

/** Export complet d'un périmètre, plafonné pour rester ouvrable dans un tableur. */
export function exportMissingPrice(scope: MissingPriceScope) {
	return rows(scope).limit(100_000);
}

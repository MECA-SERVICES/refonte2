/**
 * Historique de commandes côté client — CDC section 09.
 *
 * Distinct de `orders.ts`, qui sert le back-office : chaque lecture est bornée
 * au client de la session (R1). L'identifiant client vient toujours de la
 * session, jamais de l'URL.
 */

import {
	and,
	desc,
	eq,
	exists,
	gte,
	ilike,
	inArray,
	lt,
	max,
	min,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import { db } from './db';
import { order, orderInvoice, orderLine, orderState } from './db/order.schema';
import { brand, product } from './db/catalog.schema';
import { firstImageSql, isBrandLogoSql, thumbnailWithBrandFallbackSql } from './pricing';

/**
 * Vignette d'une ligne de commande : la photo figée à l'achat, à défaut la
 * première photo actuelle du produit, à défaut le logo de sa marque — même
 * repli que les cartes produit. La reprise PrestaShop n'a figé aucune photo,
 * d'où la relecture du catalogue. Suppose les jointures `product` et `brand`.
 */
const lineImageSql = sql<string | null>`COALESCE(
	${orderLine.productImageUrl},
	${firstImageSql(orderLine.productId)},
	${brand.logoUrl}
)`;

/** Vrai lorsque la vignette de la ligne est le logo de la marque. */
const lineImageIsBrandLogoSql = sql<boolean>`(
	${orderLine.productImageUrl} IS NULL
	AND ${firstImageSql(orderLine.productId)} IS NULL
	AND ${brand.logoUrl} IS NOT NULL
)`;

/** Nombre de commandes par page de l'historique. */
const PER_PAGE = 10;

/**
 * Filtres de l'historique : recherche libre, fenêtre de dates et onglet
 * « en attente d'expédition ». Tous facultatifs.
 */
export type CustomerOrderFilter = {
	/** Référence de commande, désignation ou référence d'un article. */
	q?: string;
	since?: Date;
	until?: Date;
	/** Commandes ni expédiées ni closes (annulées, remboursées…). */
	pendingShipment?: boolean;
};

function filterWhere(customerId: number, filter: CustomerOrderFilter = {}) {
	const conditions: SQL[] = [eq(order.customerId, customerId)];

	const q = filter.q?.trim();
	if (q) {
		const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		conditions.push(
			or(
				ilike(order.reference, pattern),
				exists(
					db
						.select({ one: sql`1` })
						.from(orderLine)
						.where(
							and(
								eq(orderLine.orderId, order.id),
								or(
									ilike(orderLine.productName, pattern),
									ilike(orderLine.productReference, pattern)
								)
							)
						)
				)
			)!
		);
	}
	if (filter.since) conditions.push(gte(order.createdAt, filter.since));
	if (filter.until) conditions.push(lt(order.createdAt, filter.until));
	if (filter.pendingShipment) {
		conditions.push(eq(orderState.isShipped, false), eq(orderState.isFinal, false));
	}

	return and(...conditions);
}

/**
 * Commandes du client, les plus récentes d'abord.
 *
 * Sert l'aperçu du tableau de bord comme la liste complète : `limit` distingue
 * les deux usages.
 */
export async function listCustomerOrders(
	customerId: number,
	{
		limit = PER_PAGE,
		page = 1,
		filter
	}: { limit?: number; page?: number; filter?: CustomerOrderFilter } = {}
) {
	return db
		.select({
			id: order.id,
			reference: order.reference,
			createdAt: order.createdAt,
			deliveredAt: order.deliveredAt,
			totalHt: order.totalHt,
			totalTva: order.totalTva,
			totalTtc: order.totalTtc,
			shippingAddress: order.shippingAddress,
			relayPointName: order.relayPointName,
			carrierName: order.carrierName,
			stateLabel: orderState.label,
			stateColor: orderState.color,
			isPaid: orderState.isPaid,
			isShipped: orderState.isShipped,
			isFinal: orderState.isFinal,
			trackingNumber: order.trackingNumber,
			trackingUrl: order.trackingUrl
		})
		.from(order)
		.innerJoin(orderState, eq(order.stateId, orderState.id))
		.where(filterWhere(customerId, filter))
		.orderBy(desc(order.createdAt), desc(order.id))
		.limit(limit)
		.offset((page - 1) * limit);
}

/** Nombre total de commandes répondant aux filtres, pour la pagination. */
export async function countCustomerOrders(customerId: number, filter?: CustomerOrderFilter) {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(order)
		.innerJoin(orderState, eq(order.stateId, orderState.id))
		.where(filterWhere(customerId, filter));
	return row?.count ?? 0;
}

/** Date de la toute première commande du client, pour borner les filtres. */
export async function firstCustomerOrderDate(customerId: number) {
	const [row] = await db
		.select({ first: min(order.createdAt) })
		.from(order)
		.where(eq(order.customerId, customerId));
	return row?.first ?? null;
}

/**
 * Articles et facture de chaque commande d'une page d'historique.
 *
 * Deux requêtes groupées plutôt qu'une par commande. Le lien produit et le
 * bouton « Acheter à nouveau » relisent le catalogue : absent ou désactivé,
 * l'article reste affiché sans eux.
 */
export async function loadOrderCards(orderIds: number[]) {
	if (orderIds.length === 0) return { linesByOrder: new Map(), invoiced: new Set<number>() };

	const [lines, invoices] = await Promise.all([
		db
			.select({
				id: orderLine.id,
				orderId: orderLine.orderId,
				productId: orderLine.productId,
				productName: orderLine.productName,
				productReference: orderLine.productReference,
				imageUrl: lineImageSql,
				imageIsBrandLogo: lineImageIsBrandLogoSql,
				brandName: brand.name,
				productSlug: product.slug,
				buyable: sql<boolean>`coalesce(${product.isActive} and ${product.stock} > 0, false)`,
				quantity: orderLine.quantity
			})
			.from(orderLine)
			.leftJoin(product, eq(orderLine.productId, product.id))
			.leftJoin(brand, eq(product.brandId, brand.id))
			.where(inArray(orderLine.orderId, orderIds))
			.orderBy(orderLine.id),
		db
			.select({ orderId: orderInvoice.orderId })
			.from(orderInvoice)
			.where(inArray(orderInvoice.orderId, orderIds))
	]);

	const linesByOrder = new Map<number, typeof lines>();
	for (const line of lines) {
		const bucket = linesByOrder.get(line.orderId) ?? [];
		bucket.push(line);
		linesByOrder.set(line.orderId, bucket);
	}

	return { linesByOrder, invoiced: new Set(invoices.map((i) => i.orderId)) };
}

/**
 * Articles déjà achetés par le client et toujours au catalogue, du plus
 * récemment commandé au plus ancien — onglet « Acheter à nouveau ».
 */
export async function listRebuyProducts(customerId: number, { limit = 24 } = {}) {
	const lastBought = max(order.createdAt);
	return db
		.select({
			id: product.id,
			slug: product.slug,
			name: product.name,
			reference: product.reference,
			stock: product.stock,
			imageUrl: thumbnailWithBrandFallbackSql,
			imageIsBrandLogo: isBrandLogoSql,
			brandName: brand.name,
			lastBoughtAt: lastBought
		})
		.from(orderLine)
		.innerJoin(order, eq(orderLine.orderId, order.id))
		.innerJoin(product, eq(orderLine.productId, product.id))
		.leftJoin(brand, eq(product.brandId, brand.id))
		.where(and(eq(order.customerId, customerId), eq(product.isActive, true)))
		.groupBy(product.id, brand.id)
		.orderBy(desc(lastBought))
		.limit(limit);
}

/**
 * Détail d'une commande, si elle appartient bien au client (R1).
 *
 * Les montants et les adresses proviennent de la commande elle-même, jamais du
 * catalogue ni du carnet : ce sont des copies figées à l'achat, et le taux de
 * TVA appliqué reste celui du jour de l'émission (R9).
 */
export async function getCustomerOrder(customerId: number, orderId: number) {
	const [found] = await db
		.select({
			id: order.id,
			reference: order.reference,
			createdAt: order.createdAt,
			totalHt: order.totalHt,
			totalTva: order.totalTva,
			totalTtc: order.totalTtc,
			shippingFee: order.shippingFee,
			discountAmount: order.discountAmount,
			shippingAddress: order.shippingAddress,
			billingAddress: order.billingAddress,
			trackingNumber: order.trackingNumber,
			trackingUrl: order.trackingUrl,
			paidAt: order.paidAt,
			deliveredAt: order.deliveredAt,
			invoiceNote: order.invoiceNote,
			stateLabel: orderState.label,
			stateColor: orderState.color,
			isShipped: orderState.isShipped,
			isPaid: orderState.isPaid
		})
		.from(order)
		.innerJoin(orderState, eq(order.stateId, orderState.id))
		.where(and(eq(order.id, orderId), eq(order.customerId, customerId)))
		.limit(1);

	if (!found) return undefined;

	const lines = await db
		.select({
			id: orderLine.id,
			productId: orderLine.productId,
			productName: orderLine.productName,
			productReference: orderLine.productReference,
			imageUrl: lineImageSql,
			imageIsBrandLogo: lineImageIsBrandLogoSql,
			brandName: brand.name,
			// Le slug n'est pas figé sur la ligne : on le relit au catalogue pour
			// construire le lien. Absent, le produit a été supprimé depuis l'achat
			// et la désignation reste affichée sans lien.
			productSlug: product.slug,
			quantity: orderLine.quantity,
			unitPriceHt: orderLine.unitPriceHt,
			unitPriceTtc: orderLine.unitPriceTtc,
			totalHt: orderLine.totalHt,
			totalTtc: orderLine.totalTtc
		})
		.from(orderLine)
		.leftJoin(product, eq(orderLine.productId, product.id))
		.leftJoin(brand, eq(product.brandId, brand.id))
		.where(eq(orderLine.orderId, orderId))
		.orderBy(orderLine.id);

	return { ...found, lines };
}

export { PER_PAGE as ORDERS_PER_PAGE };

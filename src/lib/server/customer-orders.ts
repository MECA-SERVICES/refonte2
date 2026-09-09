/**
 * Historique de commandes côté client — CDC section 09.
 *
 * Distinct de `orders.ts`, qui sert le back-office : chaque lecture est bornée
 * au client de la session (R1). L'identifiant client vient toujours de la
 * session, jamais de l'URL.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { order, orderLine, orderState } from './db/order.schema';
import { product } from './db/catalog.schema';

/** Nombre de commandes par page de l'historique. */
const PER_PAGE = 10;

/**
 * Commandes du client, les plus récentes d'abord.
 *
 * Sert l'aperçu du tableau de bord comme la liste complète : `limit` distingue
 * les deux usages.
 */
export async function listCustomerOrders(customerId: number, { limit = PER_PAGE, page = 1 } = {}) {
	return db
		.select({
			id: order.id,
			reference: order.reference,
			createdAt: order.createdAt,
			totalHt: order.totalHt,
			totalTva: order.totalTva,
			totalTtc: order.totalTtc,
			stateLabel: orderState.label,
			stateColor: orderState.color,
			isShipped: orderState.isShipped,
			trackingNumber: order.trackingNumber,
			trackingUrl: order.trackingUrl
		})
		.from(order)
		.innerJoin(orderState, eq(order.stateId, orderState.id))
		.where(eq(order.customerId, customerId))
		.orderBy(desc(order.createdAt), desc(order.id))
		.limit(limit)
		.offset((page - 1) * limit);
}

/** Nombre total de commandes, pour la pagination. */
export async function countCustomerOrders(customerId: number) {
	const rows = await db
		.select({ id: order.id })
		.from(order)
		.where(eq(order.customerId, customerId));
	return rows.length;
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
			productImageUrl: orderLine.productImageUrl,
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
		.where(eq(orderLine.orderId, orderId))
		.orderBy(orderLine.id);

	return { ...found, lines };
}

export { PER_PAGE as ORDERS_PER_PAGE };

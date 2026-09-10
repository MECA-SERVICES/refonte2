import { db } from '$lib/server/db';
import {
	order,
	orderLine,
	orderState,
	orderStateHistory,
	cart,
	cartItem,
	customer,
	product
} from '$lib/server/db/schema';
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { NewOrderState } from '$lib/server/db/order.schema';

// ===========================================================================
// Commandes
// ===========================================================================

const ORDER_TEXT: Record<string, PgColumn> = {
	reference: order.reference
};

const ORDER_SORT: Record<string, PgColumn> = {
	reference: order.reference,
	totalTtc: order.totalTtc,
	createdAt: order.createdAt
};

export type OrderListParams = {
	filters?: Record<string, string>;
	/** Recherche libre : porte sur toutes les informations d'une commande. */
	search?: string;
	/** États retenus ; plusieurs états peuvent être cumulés. */
	stateIds?: number[];
	/** Bornes de date de commande, au format ISO (AAAA-MM-JJ). */
	dateFrom?: string;
	dateTo?: string;
	/** Bornes de montant TTC. */
	minTotal?: number;
	maxTotal?: number;
	/** Restreint aux commandes déjà expédiées, ou à celles qui ne le sont pas. */
	shipped?: boolean;
	sort?: string;
	dir?: 'asc' | 'desc';
	page?: number;
	perPage?: number;
};

/**
 * Construit la condition de recherche libre.
 *
 * L'opérateur ne sait pas toujours dans quel champ se trouve ce qu'il cherche :
 * un numéro peut être une référence de commande, un numéro de suivi ou un code
 * postal. La saisie est donc confrontée à tous les champs porteurs de sens,
 * jointure client comprise.
 */
function searchCondition(term: string): SQL | undefined {
	const value = term.trim();
	if (!value) return undefined;

	const like = `%${value}%`;
	const parts: SQL[] = [
		ilike(order.reference, like),
		ilike(customer.firstName, like),
		ilike(customer.lastName, like),
		ilike(customer.email, like),
		ilike(customer.companyName, like),
		ilike(order.trackingNumber, like),
		ilike(order.carrierName, like),
		ilike(order.relayPointName, like),
		ilike(order.invoiceNote, like),
		ilike(order.privateNote, like),
		// Les adresses sont figées en JSON : on les interroge comme du texte,
		// ce qui couvre ville, code postal et nom du destinataire d'un coup.
		sql`${order.shippingAddress}::text ILIKE ${like}`,
		sql`${order.billingAddress}::text ILIKE ${like}`,
		// Une désignation d'article suffit à retrouver la commande qui la contient.
		sql`EXISTS (
			SELECT 1 FROM ${orderLine} l
			WHERE l.order_id = ${order.id}
			AND (l.product_name ILIKE ${like} OR l.product_reference ILIKE ${like})
		)`
	];

	// Une saisie entièrement numérique vise souvent l'identifiant lui-même.
	if (/^\d+$/.test(value)) parts.push(eq(order.id, Number(value)));

	return or(...parts);
}

/** Liste paginée des commandes (avec client + état joints). */
export async function listOrders(params: OrderListParams = {}) {
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(100, Math.max(1, params.perPage ?? 20));

	const conditions: SQL[] = [];
	for (const [key, raw] of Object.entries(params.filters ?? {})) {
		const value = raw.trim();
		if (value && ORDER_TEXT[key]) conditions.push(ilike(ORDER_TEXT[key], `%${value}%`));
	}

	// Recherche par nom/email client aussi via le filtre "customer".
	const customerFilter = params.filters?.customer?.trim();
	if (customerFilter) {
		const term = `%${customerFilter}%`;
		conditions.push(
			or(
				ilike(customer.firstName, term),
				ilike(customer.lastName, term),
				ilike(customer.email, term)
			)!
		);
	}

	const search = searchCondition(params.search ?? '');
	if (search) conditions.push(search);

	if (params.stateIds?.length) conditions.push(inArray(order.stateId, params.stateIds));

	// Bornes de date : `dateTo` couvre la journée entière, sinon une commande
	// passée à 14 h serait exclue d'une recherche s'arrêtant à sa propre date.
	if (params.dateFrom) conditions.push(gte(order.createdAt, new Date(params.dateFrom)));
	if (params.dateTo) {
		const end = new Date(params.dateTo);
		end.setHours(23, 59, 59, 999);
		conditions.push(lte(order.createdAt, end));
	}

	if (params.minTotal !== undefined) {
		conditions.push(sql`${order.totalTtc} >= ${params.minTotal}`);
	}
	if (params.maxTotal !== undefined) {
		conditions.push(sql`${order.totalTtc} <= ${params.maxTotal}`);
	}

	if (params.shipped !== undefined) {
		conditions.push(
			params.shipped ? isNotNull(order.trackingNumber) : isNull(order.trackingNumber)
		);
	}

	const where = conditions.length ? and(...conditions) : undefined;
	const sortCol = ORDER_SORT[params.sort ?? ''] ?? order.createdAt;
	const orderBy = params.dir === 'asc' ? asc(sortCol) : desc(sortCol);

	const [{ total: totalCount }] = await db
		.select({ total: count() })
		.from(order)
		.leftJoin(customer, eq(order.customerId, customer.id))
		.where(where);

	// Une page au-delà du dernier résultat n'affiche rien : le compteur annonce
	// des commandes que la liste ne montre pas. On ramène donc la demande sur la
	// dernière page existante, cas courant quand un filtre réduit le total.
	const pageCount = Math.max(1, Math.ceil(totalCount / perPage));
	const safePage = Math.min(page, pageCount);

	const rows = await db
		.select({
			id: order.id,
			reference: order.reference,
			totalTtc: order.totalTtc,
			createdAt: order.createdAt,
			customerFirstName: customer.firstName,
			customerLastName: customer.lastName,
			stateLabel: orderState.label,
			stateColor: orderState.color
		})
		.from(order)
		.leftJoin(customer, eq(order.customerId, customer.id))
		.leftJoin(orderState, eq(order.stateId, orderState.id))
		.where(where)
		.orderBy(orderBy)
		.limit(perPage)
		.offset((safePage - 1) * perPage);

	return { rows, total: totalCount, page: safePage, perPage, pageCount };
}

/** Commande complète : lignes, client, état, historique. */
export async function getOrderFull(id: number) {
	const [row] = await db.select().from(order).where(eq(order.id, id)).limit(1);
	if (!row) return undefined;

	const [lines, cust, state, history] = await Promise.all([
		// Le visuel n'est pas figé sur les lignes reprises de PrestaShop : on le
		// relit au catalogue en repli, et le slug permet d'ouvrir la fiche.
		db
			.select({
				id: orderLine.id,
				productId: orderLine.productId,
				productName: orderLine.productName,
				productReference: orderLine.productReference,
				productImageUrl: orderLine.productImageUrl,
				unitPriceHt: orderLine.unitPriceHt,
				unitPriceTtc: orderLine.unitPriceTtc,
				quantity: orderLine.quantity,
				totalHt: orderLine.totalHt,
				totalTtc: orderLine.totalTtc,
				productSlug: product.slug,
				/** Prix d'achat courant : alimente la marge (CDC 20). */
				purchasePrice: product.purchasePrice,
				/** Stock actuel, utile lors de la préparation du colis. */
				currentStock: product.stock,
				catalogImageUrl: sql<string | null>`(
					SELECT m.url FROM product_media m
					WHERE m.product_id = ${orderLine.productId} AND m.type = 'image'
					ORDER BY m.position, m.id LIMIT 1
				)`
			})
			.from(orderLine)
			.leftJoin(product, eq(orderLine.productId, product.id))
			.where(eq(orderLine.orderId, id))
			.orderBy(asc(orderLine.id)),
		db.select().from(customer).where(eq(customer.id, row.customerId)).limit(1),
		db.select().from(orderState).where(eq(orderState.id, row.stateId)).limit(1),
		db
			.select({
				id: orderStateHistory.id,
				note: orderStateHistory.note,
				changedBy: orderStateHistory.changedBy,
				createdAt: orderStateHistory.createdAt,
				stateLabel: orderState.label,
				stateColor: orderState.color
			})
			.from(orderStateHistory)
			.leftJoin(orderState, eq(orderStateHistory.stateId, orderState.id))
			.where(eq(orderStateHistory.orderId, id))
			.orderBy(desc(orderStateHistory.createdAt))
	]);

	return { ...row, lines, customer: cust[0], state: state[0], history };
}

/** Change l'état d'une commande et journalise le changement. */
export async function changeOrderState(input: {
	orderId: number;
	stateId: number;
	changedBy?: string | null;
	note?: string | null;
}) {
	return db.transaction(async (tx) => {
		const [state] = await tx
			.select()
			.from(orderState)
			.where(eq(orderState.id, input.stateId))
			.limit(1);
		if (!state) throw new Error('État inconnu');

		await tx
			.update(order)
			.set({
				stateId: input.stateId,
				updatedAt: new Date(),
				// Marque la date de livraison quand on passe à un état "livré".
				...(state.code === 'delivered' ? { deliveredAt: new Date() } : {}),
				...(state.isPaid ? { paidAt: new Date() } : {})
			})
			.where(eq(order.id, input.orderId));

		await tx.insert(orderStateHistory).values({
			orderId: input.orderId,
			stateId: input.stateId,
			changedBy: input.changedBy ?? null,
			note: input.note ?? null
		});
	});
}

// ===========================================================================
// États de commande (référentiel)
// ===========================================================================

export function listOrderStates() {
	return db.select().from(orderState).orderBy(asc(orderState.position));
}

export async function getOrderState(id: number) {
	const [row] = await db.select().from(orderState).where(eq(orderState.id, id)).limit(1);
	return row;
}

export async function createOrderState(values: NewOrderState) {
	const [row] = await db.insert(orderState).values(values).returning();
	return row;
}

export async function updateOrderState(id: number, values: Partial<NewOrderState>) {
	const [row] = await db
		.update(orderState)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(orderState.id, id))
		.returning();
	return row;
}

export async function deleteOrderState(id: number) {
	await db.delete(orderState).where(eq(orderState.id, id));
}

export function parseOrderStateForm(form: FormData) {
	const label = form.get('label')?.toString().trim();
	const code = form.get('code')?.toString().trim();
	if (!label || !code) return { error: 'Le code et le libellé sont requis.' as const };

	return {
		values: {
			code: code.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
			label,
			color: form.get('color')?.toString().trim() || '#6b7280',
			position: Number(form.get('position')?.toString() ?? '0') || 0,
			isPaid: form.get('isPaid') != null,
			isShipped: form.get('isShipped') != null,
			isFinal: form.get('isFinal') != null,
			sendEmailOnChange: form.get('sendEmailOnChange') != null,
			hideFromClient: form.get('hideFromClient') != null
		}
	};
}

// ===========================================================================
// Paniers (lecture seule côté admin)
// ===========================================================================

export async function listCarts(page = 1, perPage = 20) {
	const p = Math.max(1, page);
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: cart.id,
				customerFirstName: customer.firstName,
				customerLastName: customer.lastName,
				customerEmail: customer.email,
				updatedAt: cart.updatedAt,
				lastActivityAt: cart.lastActivityAt,
				itemCount: count(cartItem.id)
			})
			.from(cart)
			.leftJoin(customer, eq(cart.customerId, customer.id))
			.leftJoin(cartItem, eq(cartItem.cartId, cart.id))
			.groupBy(cart.id, customer.firstName, customer.lastName, customer.email)
			.orderBy(desc(cart.lastActivityAt))
			.limit(perPage)
			.offset((p - 1) * perPage),
		db.select({ total: count() }).from(cart)
	]);

	return { rows, total, page: p, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getCartFull(id: number) {
	const [row] = await db.select().from(cart).where(eq(cart.id, id)).limit(1);
	if (!row) return undefined;

	// Un panier visiteur n'a pas encore de client rattaché (section 18, règle R2).
	const [cust, items] = await Promise.all([
		row.customerId == null
			? Promise.resolve([])
			: db.select().from(customer).where(eq(customer.id, row.customerId)).limit(1),
		db
			.select({
				id: cartItem.id,
				quantity: cartItem.quantity,
				productName: product.name,
				productReference: product.reference,
				priceHt: product.priceHt
			})
			.from(cartItem)
			.leftJoin(product, eq(cartItem.productId, product.id))
			.where(eq(cartItem.cartId, id))
	]);

	return { ...row, customer: cust[0], items };
}

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
import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
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
	stateId?: number;
	sort?: string;
	dir?: 'asc' | 'desc';
	page?: number;
	perPage?: number;
};

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
	if (params.stateId) conditions.push(eq(order.stateId, params.stateId));

	const where = conditions.length ? and(...conditions) : undefined;
	const sortCol = ORDER_SORT[params.sort ?? ''] ?? order.createdAt;
	const orderBy = params.dir === 'asc' ? asc(sortCol) : desc(sortCol);

	const [rows, [{ total }]] = await Promise.all([
		db
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
			.offset((page - 1) * perPage),
		db
			.select({ total: count() })
			.from(order)
			.leftJoin(customer, eq(order.customerId, customer.id))
			.where(where)
	]);

	return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Commande complète : lignes, client, état, historique. */
export async function getOrderFull(id: number) {
	const [row] = await db.select().from(order).where(eq(order.id, id)).limit(1);
	if (!row) return undefined;

	const [lines, cust, state, history] = await Promise.all([
		db.select().from(orderLine).where(eq(orderLine.orderId, id)).orderBy(asc(orderLine.id)),
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

	const [cust, items] = await Promise.all([
		db.select().from(customer).where(eq(customer.id, row.customerId)).limit(1),
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

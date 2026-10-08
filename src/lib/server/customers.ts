import { db } from '$lib/server/db';
import {
	customer,
	address,
	order,
	orderLine,
	orderState,
	cart,
	cartItem,
	product,
	session
} from '$lib/server/db/schema';
import { count, desc, eq, sql } from 'drizzle-orm';
import type { NewCustomer, NewAddress } from '$lib/server/db/customer.schema';
import {
	buildOrderBy,
	buildWhere,
	pageBounds,
	paginated,
	type ColumnMaps,
	type ListParams
} from '$lib/server/listing';
import { formFields, type ParseResult } from '$lib/server/forms';

const CUSTOMER_MAPS: ColumnMaps = {
	text: {
		firstName: customer.firstName,
		lastName: customer.lastName,
		email: customer.email,
		phone: customer.phone,
		companyName: customer.companyName,
		siret: customer.siret,
		vatNumber: customer.vatNumber
	},
	exact: {
		type: customer.type,
		status: customer.status
	},
	sort: {
		firstName: customer.firstName,
		lastName: customer.lastName,
		email: customer.email,
		type: customer.type,
		status: customer.status,
		companyName: customer.companyName,
		totalSpent: customer.totalSpent,
		createdAt: customer.createdAt
	},
	defaultSort: customer.createdAt
};

export type CustomerListParams = ListParams;

/** Liste paginée des clients : recherche globale + filtres par colonne + tri (tout côté serveur). */
export async function listCustomers(params: CustomerListParams = {}) {
	const { page, perPage, offset } = pageBounds(params);
	const where = buildWhere(params, CUSTOMER_MAPS);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select()
			.from(customer)
			.where(where)
			.orderBy(buildOrderBy(params, CUSTOMER_MAPS))
			.limit(perPage)
			.offset(offset),
		db.select({ total: count() }).from(customer).where(where)
	]);

	return paginated(rows, total, page, perPage);
}

/** Un client par son id (ou undefined). */
export async function getCustomer(id: number) {
	const [row] = await db.select().from(customer).where(eq(customer.id, id)).limit(1);
	return row;
}

/** Un client avec ses adresses. */
export async function getCustomerWithAddresses(id: number) {
	const row = await getCustomer(id);
	if (!row) return undefined;
	const addresses = await db
		.select()
		.from(address)
		.where(eq(address.customerId, id))
		.orderBy(desc(address.isDefaultShipping));
	return { ...row, addresses };
}

export async function createCustomer(values: NewCustomer) {
	const [row] = await db.insert(customer).values(values).returning();
	return row;
}

export async function updateCustomer(id: number, values: Partial<NewCustomer>) {
	const [row] = await db
		.update(customer)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(customer.id, id))
		.returning();
	return row;
}

export async function deleteCustomer(id: number) {
	await db.delete(customer).where(eq(customer.id, id));
}

// ----- Adresses -----

const ADDRESS_MAPS: ColumnMaps = {
	text: {
		firstName: address.firstName,
		lastName: address.lastName,
		city: address.city,
		postalCode: address.postalCode
	},
	exact: {},
	sort: {},
	defaultSort: address.createdAt
};

export type AddressListParams = Pick<ListParams, 'search' | 'page' | 'perPage'>;

/** Liste paginée globale des adresses (avec le nom du client). */
export async function listAddresses(params: AddressListParams = {}) {
	const { page, perPage, offset } = pageBounds(params);
	const where = buildWhere(params, ADDRESS_MAPS);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: address.id,
				customerId: address.customerId,
				label: address.label,
				firstName: address.firstName,
				lastName: address.lastName,
				company: address.company,
				line1: address.line1,
				city: address.city,
				postalCode: address.postalCode,
				country: address.country,
				isDefaultShipping: address.isDefaultShipping,
				isDefaultBilling: address.isDefaultBilling
			})
			.from(address)
			.where(where)
			.orderBy(desc(address.createdAt))
			.limit(perPage)
			.offset(offset),
		db.select({ total: count() }).from(address).where(where)
	]);

	return paginated(rows, total, page, perPage);
}

export async function createAddress(values: NewAddress) {
	const [row] = await db.insert(address).values(values).returning();
	return row;
}

export async function deleteAddress(id: number) {
	await db.delete(address).where(eq(address.id, id));
}

// ----- Parsing des formulaires -----

/** Extrait les champs client d'un FormData (validation minimale). */
// `userId` n'est pas saisi au formulaire : il est rattaché par l'appelant.
export function parseCustomerForm(form: FormData): ParseResult<Omit<NewCustomer, 'userId'>> {
	const { str, bool } = formFields(form);

	const firstName = str('firstName');
	const lastName = str('lastName');
	const email = str('email');

	if (!firstName || !lastName || !email) {
		return { ok: false, error: 'Prénom, nom et email sont requis.' };
	}

	return {
		ok: true,
		values: {
			firstName,
			lastName,
			email,
			phone: str('phone'),
			type: str('type') ?? 'particulier',
			status: str('status') ?? 'validated',
			companyName: str('companyName'),
			siret: str('siret'),
			vatNumber: str('vatNumber'),
			privateNote: str('privateNote'),
			newsletterSubscribed: bool('newsletterSubscribed')
		}
	};
}

// ===========================================================================
// Fiche client du back-office (vue d'ensemble façon PrestaShop)
// ===========================================================================

/**
 * Tout ce que l'équipe consulte sur la fiche d'un client : commandes,
 * paniers, produits achetés, rang parmi les meilleurs clients, connexions.
 *
 * Une commande « valide » est une commande dont l'état est considéré payé ;
 * c'est aussi la base du classement des meilleurs clients.
 */
export async function getCustomerOverview(customerId: number, userId: string) {
	const isPaid = sql<boolean>`coalesce(${orderState.isPaid}, false)`;

	const [orders, carts, products, [rankRow], sessions] = await Promise.all([
		db
			.select({
				id: order.id,
				reference: order.reference,
				createdAt: order.createdAt,
				totalTtc: order.totalTtc,
				paymentProvider: order.paymentProvider,
				stateLabel: orderState.label,
				stateColor: orderState.color,
				isPaid,
				itemCount: sql<number>`(
					SELECT coalesce(sum(ol.quantity), 0)::int FROM ${orderLine} ol
					WHERE ol.order_id = ${order.id}
				)`
			})
			.from(order)
			.leftJoin(orderState, eq(orderState.id, order.stateId))
			.where(eq(order.customerId, customerId))
			.orderBy(desc(order.createdAt)),
		db
			.select({
				id: cart.id,
				createdAt: cart.createdAt,
				lastActivityAt: cart.lastActivityAt,
				itemCount: sql<number>`coalesce(sum(${cartItem.quantity}), 0)::int`,
				// Estimation au prix HT courant : le panier ne fige aucun prix.
				totalHt: sql<string>`coalesce(sum(${cartItem.quantity} * ${product.priceHt}), 0)::numeric(12,2)::text`
			})
			.from(cart)
			.leftJoin(cartItem, eq(cartItem.cartId, cart.id))
			.leftJoin(product, eq(product.id, cartItem.productId))
			.where(eq(cart.customerId, customerId))
			.groupBy(cart.id)
			.orderBy(desc(cart.lastActivityAt))
			.limit(10),
		db
			.select({
				productId: orderLine.productId,
				name: orderLine.productName,
				reference: orderLine.productReference,
				quantity: sql<number>`sum(${orderLine.quantity})::int`,
				lastBoughtAt: sql<Date>`max(${order.createdAt})`.mapWith(order.createdAt)
			})
			.from(orderLine)
			.innerJoin(order, eq(order.id, orderLine.orderId))
			.where(eq(order.customerId, customerId))
			.groupBy(orderLine.productId, orderLine.productName, orderLine.productReference)
			.orderBy(sql`max(${order.createdAt}) desc`)
			.limit(50),
		// Rang : nombre de clients ayant davantage dépensé, plus un.
		db.execute<{ rank: number | null; spent: string }>(sql`
			WITH spent AS (
				SELECT o.customer_id, sum(o.total_ttc) AS total
				FROM ${order} o JOIN ${orderState} s ON s.id = o.state_id
				WHERE s.is_paid
				GROUP BY o.customer_id
			)
			SELECT
				(SELECT count(*)::int + 1 FROM spent WHERE total > me.total) AS rank,
				me.total::text AS spent
			FROM (SELECT coalesce((SELECT total FROM spent WHERE customer_id = ${customerId}), 0) AS total) me
		`),
		db
			.select({
				createdAt: session.createdAt,
				updatedAt: session.updatedAt,
				ipAddress: session.ipAddress,
				userAgent: session.userAgent
			})
			.from(session)
			.where(eq(session.userId, userId))
			.orderBy(desc(session.updatedAt))
			.limit(10)
	]);

	const valid = orders.filter((o) => o.isPaid);
	const spent = Number(rankRow?.spent ?? 0);

	return {
		orders,
		orderStats: {
			validCount: valid.length,
			validTotal: valid.reduce((sum, o) => sum + Number(o.totalTtc), 0),
			invalidCount: orders.length - valid.length
		},
		carts,
		products,
		// Sans commande réglée, le client n'est pas classé.
		rank: spent > 0 ? (rankRow?.rank ?? null) : null,
		lastVisitAt: sessions[0]?.updatedAt ?? null,
		sessions
	};
}

import { db } from '$lib/server/db';
import { customer, address } from '$lib/server/db/schema';
import { count, desc, eq } from 'drizzle-orm';
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

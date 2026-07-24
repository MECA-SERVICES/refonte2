import { db } from '$lib/server/db';
import { customer, address } from '$lib/server/db/schema';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { NewCustomer, NewAddress } from '$lib/server/db/customer.schema';

export type CustomerListParams = {
	search?: string;
	type?: string;
	status?: string;
	page?: number;
	perPage?: number;
};

/** Liste paginée des clients avec recherche et filtres. */
export async function listCustomers(params: CustomerListParams = {}) {
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(100, Math.max(1, params.perPage ?? 20));

	const filters: SQL[] = [];
	if (params.search) {
		const term = `%${params.search}%`;
		filters.push(
			or(
				ilike(customer.firstName, term),
				ilike(customer.lastName, term),
				ilike(customer.email, term),
				ilike(customer.companyName, term)
			)!
		);
	}
	if (params.type) filters.push(eq(customer.type, params.type));
	if (params.status) filters.push(eq(customer.status, params.status));

	const where = filters.length ? and(...filters) : undefined;

	const [rows, [{ total }]] = await Promise.all([
		db
			.select()
			.from(customer)
			.where(where)
			.orderBy(desc(customer.createdAt))
			.limit(perPage)
			.offset((page - 1) * perPage),
		db.select({ total: count() }).from(customer).where(where)
	]);

	return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
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

export type AddressListParams = {
	search?: string;
	page?: number;
	perPage?: number;
};

/** Liste paginée globale des adresses (avec le nom du client). */
export async function listAddresses(params: AddressListParams = {}) {
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(100, Math.max(1, params.perPage ?? 20));

	const filters: SQL[] = [];
	if (params.search) {
		const term = `%${params.search}%`;
		filters.push(
			or(
				ilike(address.firstName, term),
				ilike(address.lastName, term),
				ilike(address.city, term),
				ilike(address.postalCode, term)
			)!
		);
	}
	const where = filters.length ? and(...filters) : undefined;

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
			.offset((page - 1) * perPage),
		db.select({ total: count() }).from(address).where(where)
	]);

	return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function createAddress(values: NewAddress) {
	const [row] = await db.insert(address).values(values).returning();
	return row;
}

export async function deleteAddress(id: number) {
	await db.delete(address).where(eq(address.id, id));
}

// ----- Parsing des formulaires -----

function str(v: FormDataEntryValue | null): string | null {
	const s = v?.toString().trim();
	return s ? s : null;
}

/** Extrait les champs client d'un FormData (validation minimale). */
export function parseCustomerForm(form: FormData) {
	const firstName = str(form.get('firstName'));
	const lastName = str(form.get('lastName'));
	const email = str(form.get('email'));

	if (!firstName || !lastName || !email) {
		return { error: 'Prénom, nom et email sont requis.' as const };
	}

	return {
		values: {
			firstName,
			lastName,
			email,
			phone: str(form.get('phone')),
			type: str(form.get('type')) ?? 'particulier',
			status: str(form.get('status')) ?? 'validated',
			companyName: str(form.get('companyName')),
			siret: str(form.get('siret')),
			vatNumber: str(form.get('vatNumber')),
			privateNote: str(form.get('privateNote')),
			newsletterSubscribed: form.get('newsletterSubscribed') != null
		}
	};
}

import { db } from '$lib/server/db';
import { customer, address } from '$lib/server/db/schema';
import { and, asc, count, desc, eq, ilike, or, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { NewCustomer, NewAddress } from '$lib/server/db/customer.schema';

/**
 * Colonnes filtrables par saisie libre (input « contient »).
 * La clé est le nom de filtre exposé dans l'URL ; on ne filtre QUE sur ces colonnes
 * (liste blanche : pas d'injection de nom de colonne arbitraire).
 */
const TEXT_FILTER_COLUMNS: Record<string, PgColumn> = {
	firstName: customer.firstName,
	lastName: customer.lastName,
	email: customer.email,
	phone: customer.phone,
	companyName: customer.companyName,
	siret: customer.siret,
	vatNumber: customer.vatNumber
};

/** Colonnes filtrables par égalité stricte (menus déroulants). */
const EXACT_FILTER_COLUMNS: Record<string, PgColumn> = {
	type: customer.type,
	status: customer.status
};

/** Colonnes autorisées au tri (liste blanche). */
const SORT_COLUMNS: Record<string, PgColumn> = {
	firstName: customer.firstName,
	lastName: customer.lastName,
	email: customer.email,
	type: customer.type,
	status: customer.status,
	companyName: customer.companyName,
	totalSpent: customer.totalSpent,
	createdAt: customer.createdAt
};

export type CustomerListParams = {
	/** Recherche globale (tous les champs texte à la fois). */
	search?: string;
	/** Filtres par colonne : { firstName: 'jean', email: '@gmail', type: 'entreprise', ... }. */
	filters?: Record<string, string>;
	sort?: string;
	dir?: 'asc' | 'desc';
	page?: number;
	perPage?: number;
};

/** Liste paginée des clients : recherche globale + filtres par colonne + tri (tout côté serveur). */
export async function listCustomers(params: CustomerListParams = {}) {
	const page = Math.max(1, params.page ?? 1);
	const perPage = Math.min(100, Math.max(1, params.perPage ?? 20));

	const conditions: SQL[] = [];

	// Recherche globale : le terme doit apparaître dans au moins une colonne texte.
	if (params.search) {
		const term = `%${params.search}%`;
		const parts = Object.values(TEXT_FILTER_COLUMNS).map((col) => ilike(col, term));
		conditions.push(or(...parts)!);
	}

	// Filtres par colonne.
	for (const [key, raw] of Object.entries(params.filters ?? {})) {
		const value = raw.trim();
		if (!value) continue;
		if (TEXT_FILTER_COLUMNS[key]) {
			conditions.push(ilike(TEXT_FILTER_COLUMNS[key], `%${value}%`));
		} else if (EXACT_FILTER_COLUMNS[key]) {
			conditions.push(eq(EXACT_FILTER_COLUMNS[key], value));
		}
	}

	const where = conditions.length ? and(...conditions) : undefined;

	// Tri : colonne en liste blanche, direction bornée, défaut = plus récents.
	const sortColumn: SQLWrapper = SORT_COLUMNS[params.sort ?? ''] ?? customer.createdAt;
	const orderBy = params.dir === 'asc' ? asc(sortColumn) : desc(sortColumn);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select()
			.from(customer)
			.where(where)
			.orderBy(orderBy)
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

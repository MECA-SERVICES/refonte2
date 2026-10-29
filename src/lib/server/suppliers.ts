/**
 * Fournisseurs et approvisionnement (CDC 11), repris de PrestaShop et de
 * Dolibarr (voir `MIGRATION-DOLIBARR.md`).
 *
 * - un **fournisseur** : identité, coordonnées, SIRET, notes internes ; archivé
 *   plutôt que supprimé dès qu'il approvisionne un produit (R4, R5) ;
 * - ses **conditions** pour un produit (`supplier_product`) : référence chez
 *   lui, prix d'achat négocié, délai, quantité minimale ; un produit peut en
 *   avoir plusieurs (R1) ;
 * - le **fournisseur principal** d'un produit est `product.supplier_id` (R2) :
 *   son prix d'achat et sa référence alimentent la fiche produit (R3), donc la
 *   marge.
 *
 * Rien de tout cela n'est montré au client (R6).
 */
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { product, supplier, supplierProduct } from '$lib/server/db/catalog.schema';
import { formFields, type ParseResult } from '$lib/server/forms';
import { paginated } from '$lib/server/listing';
import { syncProducts } from '$lib/server/meili';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class SupplierError extends Error {}

// ===========================================================================
// Fournisseurs
// ===========================================================================

export type SupplierInput = Omit<
	typeof supplier.$inferInsert,
	'id' | 'legacyPsId' | 'legacyDoliId' | 'createdAt' | 'updatedAt'
>;

export function parseSupplierForm(form: FormData): ParseResult<SupplierInput> {
	const { str, bool } = formFields(form);
	const name = str('name');
	if (!name) return { ok: false, error: 'Indiquez la raison sociale du fournisseur.' };
	const siret = str('siret')?.replace(/\s/g, '') ?? null;
	if (siret && !/^\d{14}$/.test(siret)) {
		return { ok: false, error: 'Le SIRET compte 14 chiffres.' };
	}
	return {
		ok: true,
		values: {
			name,
			code: str('code'),
			email: str('email')?.toLowerCase() ?? null,
			phone: str('phone'),
			line1: str('line1'),
			line2: str('line2'),
			postalCode: str('postalCode'),
			city: str('city'),
			country: (str('country') ?? 'FR').toUpperCase().slice(0, 2),
			siret,
			vatNumber: str('vatNumber'),
			notes: str('notes'),
			isActive: bool('isActive')
		}
	};
}

/** Nombre de produits approvisionnés, et dont il est le fournisseur principal. */
const linkedSql = sql<number>`(select count(*)::int from ${supplierProduct} sp where sp.supplier_id = ${supplier}.id)`;
const mainSql = sql<number>`(select count(*)::int from ${product} p where p.supplier_id = ${supplier}.id)`;

/** Fournisseurs, actifs d'abord, filtrés par nom, code, e-mail ou ville. */
export function listSuppliers(term: string) {
	const q = term.trim();
	const like = `%${q}%`;
	return db
		.select({
			id: supplier.id,
			name: supplier.name,
			code: supplier.code,
			email: supplier.email,
			phone: supplier.phone,
			city: supplier.city,
			isActive: supplier.isActive,
			linked: linkedSql,
			main: mainSql
		})
		.from(supplier)
		.where(
			q
				? or(
						ilike(supplier.name, like),
						ilike(supplier.code, like),
						ilike(supplier.email, like),
						ilike(supplier.city, like)
					)
				: undefined
		)
		.orderBy(sql`${supplier.isActive} desc`, asc(supplier.name));
}

/** Fournisseurs proposés au rattachement : les actifs seulement (R4). */
export function supplierOptions() {
	return db
		.select({ id: supplier.id, name: supplier.name })
		.from(supplier)
		.where(eq(supplier.isActive, true))
		.orderBy(asc(supplier.name));
}

export async function getSupplier(id: number) {
	const [row] = await db
		.select({ supplier, linked: linkedSql, main: mainSql })
		.from(supplier)
		.where(eq(supplier.id, id));
	return row ?? null;
}

/**
 * Produits d'un fournisseur et ses conditions, par pages : KRAMP en
 * approvisionne 700 000. `q` cherche dans la référence et le nom du produit,
 * ou la référence fournisseur exacte.
 */
export async function listSupplierProducts(supplierId: number, q: string, page: number) {
	const perPage = 50;
	const term = q.trim();
	const where = and(
		eq(supplierProduct.supplierId, supplierId),
		term
			? or(
					ilike(product.reference, `%${term}%`),
					ilike(product.name, `%${term}%`),
					eq(supplierProduct.supplierReference, term)
				)
			: undefined
	);
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				productId: product.id,
				reference: product.reference,
				name: product.name,
				isActive: product.isActive,
				stock: product.stock,
				isMain: sql<boolean>`${product.supplierId} = ${supplierId}`,
				supplierReference: supplierProduct.supplierReference,
				purchasePrice: supplierProduct.purchasePrice,
				deliveryDays: supplierProduct.deliveryDays,
				minQuantity: supplierProduct.minQuantity
			})
			.from(supplierProduct)
			.innerJoin(product, eq(product.id, supplierProduct.productId))
			.where(where)
			// Ordre de l'index (fournisseur, produit) : pas de tri sur 700 000 lignes.
			.orderBy(asc(supplierProduct.productId))
			.limit(perPage)
			.offset((Math.max(1, page) - 1) * perPage),
		db
			.select({ total: count() })
			.from(supplierProduct)
			.innerJoin(product, eq(product.id, supplierProduct.productId))
			.where(where)
	]);
	return paginated(rows, total, Math.max(1, page), perPage);
}

export async function createSupplier(input: SupplierInput) {
	const [row] = await db.insert(supplier).values(input).returning({ id: supplier.id });
	return row.id;
}

export async function updateSupplier(id: number, input: SupplierInput) {
	await db
		.update(supplier)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(supplier.id, id));
}

/** Supprime un fournisseur qui n'approvisionne aucun produit ; sinon, l'archiver (R5). */
export async function deleteSupplier(id: number) {
	const found = await getSupplier(id);
	if (!found) throw new SupplierError('Fournisseur introuvable.');
	if (found.linked || found.main) {
		throw new SupplierError(
			'Ce fournisseur approvisionne des produits : archivez-le plutôt que de le supprimer.'
		);
	}
	await db.delete(supplier).where(eq(supplier.id, id));
}

// ===========================================================================
// Approvisionnement d'un produit
// ===========================================================================

/** Fournisseurs d'un produit et leurs conditions, le principal d'abord. */
export function listProductSupply(productId: number) {
	return db
		.select({
			supplierId: supplier.id,
			name: supplier.name,
			isActive: supplier.isActive,
			isMain: sql<boolean>`coalesce(${product.supplierId} = ${supplier.id}, false)`,
			supplierReference: supplierProduct.supplierReference,
			purchasePrice: supplierProduct.purchasePrice,
			deliveryDays: supplierProduct.deliveryDays,
			minQuantity: supplierProduct.minQuantity
		})
		.from(supplierProduct)
		.innerJoin(supplier, eq(supplier.id, supplierProduct.supplierId))
		.innerJoin(product, eq(product.id, supplierProduct.productId))
		.where(eq(supplierProduct.productId, productId))
		.orderBy(sql`${product.supplierId} = ${supplier.id} desc`, asc(supplier.name));
}

export type SupplyInput = {
	supplierId: number;
	supplierReference: string | null;
	purchasePrice: string | null;
	deliveryDays: number | null;
	minQuantity: number | null;
	isMain: boolean;
};

export function parseSupplyForm(form: FormData): ParseResult<SupplyInput> {
	const { str, num, bool } = formFields(form);
	const supplierId = Number(form.get('supplierId'));
	if (!Number.isInteger(supplierId) || supplierId <= 0) {
		return { ok: false, error: 'Choisissez le fournisseur.' };
	}
	const whole = (key: string) => {
		const v = str(key);
		return v === null ? null : Number(v);
	};
	const deliveryDays = whole('deliveryDays');
	const minQuantity = whole('minQuantity');
	for (const [label, v] of [
		['Le délai', deliveryDays],
		['La quantité minimale', minQuantity]
	] as const) {
		if (v !== null && !(Number.isInteger(v) && v >= 0)) {
			return { ok: false, error: `${label} est un nombre entier positif.` };
		}
	}
	const purchasePrice = num('purchasePrice');
	if (purchasePrice !== null && Number(purchasePrice) < 0) {
		return { ok: false, error: 'Le prix d’achat ne peut pas être négatif.' };
	}
	return {
		ok: true,
		values: {
			supplierId,
			supplierReference: str('supplierReference'),
			purchasePrice,
			deliveryDays,
			minQuantity,
			isMain: bool('isMain')
		}
	};
}

/**
 * Le fournisseur principal alimente la fiche produit (R3) : son prix d'achat
 * (la marge) et sa référence (cherchée par la recherche de la boutique).
 */
async function applyMain(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	productId: number,
	supplierId: number
) {
	const [row] = await tx
		.select()
		.from(supplierProduct)
		.where(
			and(eq(supplierProduct.productId, productId), eq(supplierProduct.supplierId, supplierId))
		);
	await tx
		.update(product)
		.set({
			supplierId,
			...(row?.purchasePrice ? { purchasePrice: row.purchasePrice } : {}),
			...(row?.supplierReference ? { supplierReference: row.supplierReference } : {}),
			updatedAt: new Date()
		})
		.where(eq(product.id, productId));
}

/**
 * Ajoute ou met à jour les conditions d'un fournisseur pour un produit. Un
 * fournisseur archivé garde ses rattachements mais n'en reçoit pas de nouveau (R4).
 */
export async function saveProductSupply(productId: number, input: SupplyInput) {
	await db.transaction(async (tx) => {
		const [s] = await tx
			.select({ isActive: supplier.isActive })
			.from(supplier)
			.where(eq(supplier.id, input.supplierId));
		if (!s) throw new SupplierError('Fournisseur introuvable.');
		const [existing] = await tx
			.select({ id: supplierProduct.id })
			.from(supplierProduct)
			.where(
				and(
					eq(supplierProduct.productId, productId),
					eq(supplierProduct.supplierId, input.supplierId)
				)
			);
		if (!existing && !s.isActive) {
			throw new SupplierError('Fournisseur archivé : il n’est plus proposé au rattachement.');
		}
		const values = {
			supplierReference: input.supplierReference,
			purchasePrice: input.purchasePrice,
			deliveryDays: input.deliveryDays,
			minQuantity: input.minQuantity,
			updatedAt: new Date()
		};
		if (existing) {
			await tx.update(supplierProduct).set(values).where(eq(supplierProduct.id, existing.id));
		} else {
			await tx
				.insert(supplierProduct)
				.values({ ...values, productId, supplierId: input.supplierId });
		}
		const [p] = await tx
			.select({ supplierId: product.supplierId })
			.from(product)
			.where(eq(product.id, productId));
		// Le premier fournisseur d'un produit en devient le principal.
		if (input.isMain || p?.supplierId === input.supplierId || p?.supplierId === null) {
			await applyMain(tx, productId, input.supplierId);
		}
	});
	syncProducts([productId]);
}

/** Désigne le fournisseur principal d'un produit (R2). */
export async function setMainSupplier(productId: number, supplierId: number) {
	await db.transaction((tx) => applyMain(tx, productId, supplierId));
	syncProducts([productId]);
}

/** Retire un fournisseur d'un produit ; s'il était le principal, le produit n'en a plus. */
export async function removeProductSupply(productId: number, supplierId: number) {
	await db.transaction(async (tx) => {
		await tx
			.delete(supplierProduct)
			.where(
				and(eq(supplierProduct.productId, productId), eq(supplierProduct.supplierId, supplierId))
			);
		await tx
			.update(product)
			.set({ supplierId: null, updatedAt: new Date() })
			.where(and(eq(product.id, productId), eq(product.supplierId, supplierId)));
	});
}

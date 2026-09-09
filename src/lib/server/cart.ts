import { db } from '$lib/server/db';
import {
	brand,
	cart,
	cartItem,
	customer,
	product,
	productMedia,
	taxRule
} from '$lib/server/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { effectiveTaxRate, type TaxRegime } from '$lib/tax';

/**
 * Domaine « Panier » — section 18 du cahier des charges.
 *
 * Un panier appartient soit à un client connecté (`customer_id`), soit à un
 * visiteur identifié par un jeton de session (`session_token`, règle R2). À la
 * connexion, le panier visiteur est fusionné dans celui du compte.
 *
 * La présence d'un article dans un panier ne réserve aucun stock : la
 * réservation n'intervient qu'à la création de la commande (règle R8).
 */

/** Nom du cookie portant le jeton de panier visiteur. */
export const CART_COOKIE = 'ms_cart';

/** Durée de vie du panier visiteur : 30 jours. */
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Prix TTC calculé en SQL, comme dans le service vitrine. */
const priceTtc = sql<string>`round(${product.priceHt} * (1 + coalesce(${taxRule.rate}, 0) / 100), 2)`;

/** Vignette : première image du produit. */
const thumbnail = sql<string | null>`(
	SELECT m.url FROM ${productMedia} m
	WHERE m.product_id = ${product.id} AND m.type = 'image'
	ORDER BY m.position, m.id
	LIMIT 1
)`;

export type CartLine = {
	id: number;
	productId: number;
	variantId: number | null;
	quantity: number;
	name: string;
	slug: string;
	reference: string;
	brandName: string | null;
	imageUrl: string | null;
	stock: number;
	isActive: boolean;
	priceHt: string;
	priceTtc: string;
	taxRate: string | null;
	/** Prix HT au moment de l'ajout, s'il a été enregistré. */
	priceHtAtAdd: string | null;
};

export type CartTotals = {
	subtotalHt: number;
	tax: number;
	totalTtc: number;
	itemCount: number;
};

export type CartView = {
	id: number | null;
	lines: CartLine[];
	totals: CartTotals;
	/** Lignes dont l'article n'est plus commandable (règle R7). */
	hasBlockingLine: boolean;
};

/** Panier vide — évite de créer une ligne en base pour un simple affichage. */
const EMPTY: CartView = {
	id: null,
	lines: [],
	totals: { subtotalHt: 0, tax: 0, totalTtc: 0, itemCount: 0 },
	hasBlockingLine: false
};

/** Identité du porteur du panier : un client connecté, ou un jeton visiteur. */
export type CartOwner = { customerId: number } | { sessionToken: string };

function ownerCondition(owner: CartOwner) {
	return 'customerId' in owner
		? eq(cart.customerId, owner.customerId)
		: and(eq(cart.sessionToken, owner.sessionToken), isNull(cart.customerId))!;
}

/** Fiche client rattachée à un compte better-auth, si elle existe. */
export async function customerIdForUser(userId: string): Promise<number | null> {
	const [row] = await db
		.select({ id: customer.id })
		.from(customer)
		.where(eq(customer.userId, userId))
		.limit(1);
	return row?.id ?? null;
}

/** Panier existant du porteur, sans le créer. */
async function findCart(owner: CartOwner) {
	const [row] = await db.select().from(cart).where(ownerCondition(owner)).limit(1);
	return row;
}

/** Panier du porteur, créé au besoin (à l'ajout d'un premier article). */
async function findOrCreateCart(owner: CartOwner) {
	const existing = await findCart(owner);
	if (existing) return existing;

	const [created] = await db
		.insert(cart)
		.values(
			'customerId' in owner
				? { customerId: owner.customerId }
				: { sessionToken: owner.sessionToken }
		)
		.returning();
	return created;
}

/** Toute action sur le panier met à jour sa date de dernière activité (règle R9). */
async function touch(cartId: number) {
	await db
		.update(cart)
		.set({ lastActivityAt: new Date(), updatedAt: new Date() })
		.where(eq(cart.id, cartId));
}

/** Lignes du panier enrichies du produit, pour affichage et calculs. */
async function linesOf(cartId: number): Promise<CartLine[]> {
	return db
		.select({
			id: cartItem.id,
			productId: cartItem.productId,
			variantId: cartItem.variantId,
			quantity: cartItem.quantity,
			priceHtAtAdd: cartItem.priceHtAtAdd,
			name: product.name,
			slug: product.slug,
			reference: product.reference,
			brandName: brand.name,
			imageUrl: thumbnail,
			stock: product.stock,
			isActive: product.isActive,
			priceHt: product.priceHt,
			priceTtc,
			taxRate: taxRule.rate
		})
		.from(cartItem)
		.innerJoin(product, eq(cartItem.productId, product.id))
		.leftJoin(brand, eq(product.brandId, brand.id))
		.leftJoin(taxRule, eq(product.taxRuleId, taxRule.id))
		.where(eq(cartItem.cartId, cartId))
		.orderBy(cartItem.id);
}

/**
 * Totaux du panier. Les prix retenus sont ceux en vigueur (règle R10).
 *
 * La TVA est recalculée à partir du taux du produit et du régime du client, et
 * non déduite de l'écart TTC/HT : le TTC issu de la requête suppose toujours le
 * régime standard, ce qui facturerait la taxe à un client exonéré (CDC 23,
 * R1-R2). Le taux variant d'un article à l'autre, le calcul reste ligne à ligne.
 */
export function computeTotals(lines: CartLine[], regime: TaxRegime = 'standard'): CartTotals {
	let subtotalHt = 0;
	let tax = 0;
	let itemCount = 0;

	for (const line of lines) {
		const lineHt = Number(line.priceHt) * line.quantity;
		subtotalHt += lineHt;
		tax += lineHt * (effectiveTaxRate(line.taxRate, regime) / 100);
		itemCount += line.quantity;
	}

	const round = (n: number) => Math.round(n * 100) / 100;
	const ht = round(subtotalHt);
	const tva = round(tax);
	return {
		subtotalHt: ht,
		tax: tva,
		totalTtc: round(ht + tva),
		itemCount
	};
}

/** Un article désactivé ou en rupture bloque le passage en commande (règle R7). */
function isBlocking(line: CartLine) {
	return !line.isActive || line.stock <= 0;
}

/**
 * Panier complet du porteur, prêt à afficher.
 *
 * Le régime conditionne la TVA des totaux : un client exonéré ne doit pas la
 * voir apparaître (R18). À défaut, le régime standard s'applique.
 */
export async function getCart(owner: CartOwner, regime: TaxRegime = 'standard'): Promise<CartView> {
	const found = await findCart(owner);
	if (!found) return EMPTY;

	const lines = await linesOf(found.id);
	return {
		id: found.id,
		lines,
		totals: computeTotals(lines, regime),
		hasBlockingLine: lines.some(isBlocking)
	};
}

/** Nombre d'articles du panier — alimente l'indicateur de l'en-tête. */
export async function countCartItems(owner: CartOwner): Promise<number> {
	const found = await findCart(owner);
	if (!found) return 0;

	const [row] = await db
		.select({ total: sql<number>`coalesce(sum(${cartItem.quantity}), 0)::int` })
		.from(cartItem)
		.where(eq(cartItem.cartId, found.id));
	return row?.total ?? 0;
}

/** Résultat d'un ajout : la quantité peut avoir été plafonnée (règle R6). */
export type AddResult =
	| { ok: true; quantity: number; capped: boolean; available: number }
	| { ok: false; reason: 'unavailable' | 'not_found' };

/**
 * Ajoute un article au panier, ou incrémente la ligne existante (règle R4).
 * La quantité demandée est plafonnée à la quantité disponible (règle R6).
 */
export async function addToCart(
	owner: CartOwner,
	input: { productId: number; variantId?: number | null; quantity: number }
): Promise<AddResult> {
	const quantity = Math.max(1, Math.trunc(input.quantity) || 1);

	const [item] = await db
		.select({ stock: product.stock, isActive: product.isActive, priceHt: product.priceHt })
		.from(product)
		.where(eq(product.id, input.productId))
		.limit(1);

	if (!item) return { ok: false, reason: 'not_found' };
	// Un article inactif ou sans disponibilité ne peut pas être ajouté (règle R7).
	if (!item.isActive || item.stock <= 0) return { ok: false, reason: 'unavailable' };

	const target = await findOrCreateCart(owner);
	const variantId = input.variantId ?? null;

	const [existing] = await db
		.select()
		.from(cartItem)
		.where(
			and(
				eq(cartItem.cartId, target.id),
				eq(cartItem.productId, input.productId),
				variantId === null ? isNull(cartItem.variantId) : eq(cartItem.variantId, variantId)
			)
		)
		.limit(1);

	const wanted = (existing?.quantity ?? 0) + quantity;
	const capped = Math.min(wanted, item.stock);

	if (existing) {
		await db
			.update(cartItem)
			.set({ quantity: capped, updatedAt: new Date() })
			.where(eq(cartItem.id, existing.id));
	} else {
		await db.insert(cartItem).values({
			cartId: target.id,
			productId: input.productId,
			variantId,
			quantity: capped,
			priceHtAtAdd: item.priceHt
		});
	}

	await touch(target.id);
	return { ok: true, quantity: capped, capped: capped < wanted, available: item.stock };
}

/**
 * Change la quantité d'une ligne. Une quantité nulle supprime la ligne
 * (règle R5) ; un dépassement est plafonné au stock disponible (règle R6).
 */
export async function updateLineQuantity(
	owner: CartOwner,
	lineId: number,
	quantity: number
): Promise<{ ok: boolean; capped?: boolean }> {
	const found = await findCart(owner);
	if (!found) return { ok: false };

	const [line] = await db
		.select({ id: cartItem.id, stock: product.stock })
		.from(cartItem)
		.innerJoin(product, eq(cartItem.productId, product.id))
		.where(and(eq(cartItem.id, lineId), eq(cartItem.cartId, found.id)))
		.limit(1);

	if (!line) return { ok: false };

	const wanted = Math.trunc(quantity) || 0;
	if (wanted <= 0) {
		await db.delete(cartItem).where(eq(cartItem.id, line.id));
		await touch(found.id);
		return { ok: true };
	}

	const capped = Math.min(wanted, Math.max(1, line.stock));
	await db
		.update(cartItem)
		.set({ quantity: capped, updatedAt: new Date() })
		.where(eq(cartItem.id, line.id));
	await touch(found.id);
	return { ok: true, capped: capped < wanted };
}

/** Supprime une ligne du panier. */
export async function removeLine(owner: CartOwner, lineId: number): Promise<boolean> {
	const found = await findCart(owner);
	if (!found) return false;

	const deleted = await db
		.delete(cartItem)
		.where(and(eq(cartItem.id, lineId), eq(cartItem.cartId, found.id)))
		.returning({ id: cartItem.id });

	if (deleted.length > 0) await touch(found.id);
	return deleted.length > 0;
}

/** Vide le panier de toutes ses lignes. */
export async function clearCart(owner: CartOwner): Promise<void> {
	const found = await findCart(owner);
	if (!found) return;

	await db.delete(cartItem).where(eq(cartItem.cartId, found.id));
	await touch(found.id);
}

/**
 * Fusionne le panier visiteur dans celui du client à la connexion (règle R2).
 * Les quantités d'un même article s'additionnent, dans la limite du stock
 * disponible (règle R3). Le panier visiteur est ensuite supprimé.
 */
export async function mergeGuestCart(sessionToken: string, customerId: number): Promise<void> {
	const guest = await findCart({ sessionToken });
	if (!guest) return;

	const guestLines = await db.select().from(cartItem).where(eq(cartItem.cartId, guest.id));

	if (guestLines.length === 0) {
		await db.delete(cart).where(eq(cart.id, guest.id));
		return;
	}

	const target = await findOrCreateCart({ customerId });

	// Le panier visiteur peut être rattaché tel quel s'il n'y a rien à fusionner.
	if (target.id === guest.id) return;

	for (const line of guestLines) {
		const [item] = await db
			.select({ stock: product.stock })
			.from(product)
			.where(eq(product.id, line.productId))
			.limit(1);
		if (!item) continue;

		const [existing] = await db
			.select()
			.from(cartItem)
			.where(
				and(
					eq(cartItem.cartId, target.id),
					eq(cartItem.productId, line.productId),
					line.variantId === null
						? isNull(cartItem.variantId)
						: eq(cartItem.variantId, line.variantId)
				)
			)
			.limit(1);

		const wanted = (existing?.quantity ?? 0) + line.quantity;
		const capped = Math.min(wanted, Math.max(1, item.stock));

		if (existing) {
			await db
				.update(cartItem)
				.set({ quantity: capped, updatedAt: new Date() })
				.where(eq(cartItem.id, existing.id));
		} else {
			await db.insert(cartItem).values({
				cartId: target.id,
				productId: line.productId,
				variantId: line.variantId,
				quantity: capped,
				priceHtAtAdd: line.priceHtAtAdd
			});
		}
	}

	await db.delete(cart).where(eq(cart.id, guest.id));
	await touch(target.id);
}

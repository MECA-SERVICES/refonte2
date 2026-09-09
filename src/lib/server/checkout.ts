/**
 * Création de commande depuis le panier — CDC sections 20 et 22.
 *
 * Le paiement se limite pour l'instant au **virement bancaire** : il ne dépend
 * d'aucun prestataire externe, ce qui permet de valider tout l'enchaînement —
 * adresses, livraison, stock, états — avant de brancher Monetico et Sofinco.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { cartItem, order, orderLine, orderState, orderStateHistory } from './db/order.schema';
import { address } from './db/customer.schema';
import { product } from './db/catalog.schema';
import { effectiveTaxRate, type TaxRegime } from '$lib/tax';

/** État d'entrée d'une commande réglée par virement. */
const BANK_TRANSFER_STATE = 'en-attente-du-paiement-par-virement-bancaire';

/** Adresse figée sur la commande — le carnet peut changer ensuite (R3 section 09). */
type FrozenAddress = {
	firstName: string;
	lastName: string;
	company: string | null;
	line1: string;
	line2: string | null;
	postalCode: string;
	city: string;
	country: string;
	phone: string | null;
};

export type CheckoutInput = {
	customerId: number;
	cartId: number;
	shippingAddressId: number;
	billingAddressId: number;
	regime: TaxRegime;
	shipping: {
		optionCode: string;
		carrierCode: string;
		carrierName: string;
		/** Frais de port hors taxes, surcoût produit compris. */
		feeHt: number;
		usedFallback: boolean;
		relayPointId?: string | null;
		relayPointName?: string | null;
		relayPointAddress?: string | null;
	};
	/** Poids retenu, reporté sur la commande pour préparer l'expédition. */
	weightKg: number;
};

/**
 * Référence lisible, unique et non devinable.
 *
 * Le millésime facilite le classement en back-office ; le suffixe aléatoire
 * évite qu'un client déduise le volume d'affaires depuis son numéro.
 */
function buildReference(): string {
	const year = new Date().getFullYear();
	const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
	return `MS-${year}-${suffix}`;
}

function freeze(row: typeof address.$inferSelect): FrozenAddress {
	return {
		firstName: row.firstName,
		lastName: row.lastName,
		company: row.company,
		line1: row.line1,
		line2: row.line2,
		postalCode: row.postalCode,
		city: row.city,
		country: row.country,
		phone: row.phone
	};
}

export class CheckoutError extends Error {}

/**
 * Transforme un panier en commande.
 *
 * Tout se joue dans une transaction : lignes, totaux, état initial et vidage du
 * panier. Un échec en cours de route ne doit jamais laisser une commande à
 * moitié créée ni un panier consommé sans contrepartie.
 *
 * Le stock n'est pas décrémenté ici : il ne l'est qu'à l'expédition
 * (CDC 22), une commande en attente de virement pouvant rester longtemps
 * sans paiement.
 */
export async function createOrderFromCart(input: CheckoutInput) {
	return db.transaction(async (tx) => {
		const [state] = await tx
			.select({ id: orderState.id })
			.from(orderState)
			.where(eq(orderState.code, BANK_TRANSFER_STATE))
			.limit(1);
		if (!state) throw new CheckoutError('État de commande introuvable.');

		// Les adresses sont relues sous leur propriétaire : un identifiant venu
		// du formulaire ne suffit pas à prouver qu'elles appartiennent au client.
		const addresses = await tx
			.select()
			.from(address)
			.where(eq(address.customerId, input.customerId));

		const shippingAddress = addresses.find((a) => a.id === input.shippingAddressId);
		const billingAddress = addresses.find((a) => a.id === input.billingAddressId);
		if (!shippingAddress || !billingAddress) throw new CheckoutError('Adresse introuvable.');

		// Les prix sont relus au catalogue, jamais repris du navigateur.
		const lines = await tx
			.select({
				productId: product.id,
				name: product.name,
				reference: product.reference,
				priceHt: product.priceHt,
				taxRate: sql<string | null>`(select rate from tax_rule where id = ${product.taxRuleId})`,
				quantity: cartItem.quantity
			})
			.from(cartItem)
			.innerJoin(product, eq(cartItem.productId, product.id))
			.where(and(eq(cartItem.cartId, input.cartId), eq(product.isActive, true)));

		if (lines.length === 0) throw new CheckoutError('Le panier est vide.');

		let totalHt = 0;
		let totalTva = 0;

		const prepared = lines.map((line) => {
			const unitHt = Number(line.priceHt);
			const rate = effectiveTaxRate(line.taxRate, input.regime);
			const lineHt = unitHt * line.quantity;
			const lineTva = lineHt * (rate / 100);

			totalHt += lineHt;
			totalTva += lineTva;

			return {
				productId: line.productId,
				productName: line.name,
				productReference: line.reference,
				unitPriceHt: unitHt.toFixed(4),
				unitPriceTtc: (unitHt * (1 + rate / 100)).toFixed(4),
				quantity: line.quantity,
				totalHt: lineHt.toFixed(2),
				totalTtc: (lineHt + lineTva).toFixed(2)
			};
		});

		// Les frais de port suivent le régime des articles (R13 section 23).
		const shippingRate = effectiveTaxRate(20, input.regime);
		const shippingTva = input.shipping.feeHt * (shippingRate / 100);

		const round = (n: number) => Math.round(n * 100) / 100;
		const grandHt = round(totalHt + input.shipping.feeHt);
		const grandTva = round(totalTva + shippingTva);

		const [created] = await tx
			.insert(order)
			.values({
				reference: buildReference(),
				customerId: input.customerId,
				stateId: state.id,
				totalHt: grandHt.toFixed(2),
				totalTva: grandTva.toFixed(2),
				totalTtc: round(grandHt + grandTva).toFixed(2),
				shippingFee: input.shipping.feeHt.toFixed(2),
				shippingAddress: freeze(shippingAddress),
				billingAddress: freeze(billingAddress),
				carrierCode: input.shipping.carrierCode,
				carrierName: input.shipping.carrierName,
				shippingOptionCode: input.shipping.optionCode,
				relayPointId: input.shipping.relayPointId ?? null,
				relayPointName: input.shipping.relayPointName ?? null,
				relayPointAddress: input.shipping.relayPointAddress ?? null,
				usedFallbackShipping: input.shipping.usedFallback,
				packageWeightKg: input.weightKg.toFixed(3),
				paymentProvider: 'bank_transfer'
			})
			.returning({ id: order.id, reference: order.reference });

		await tx.insert(orderLine).values(prepared.map((l) => ({ ...l, orderId: created.id })));

		// L'historique démarre dès la création : le premier état doit y figurer
		// comme les suivants, sinon la chronologie est incomplète.
		await tx.insert(orderStateHistory).values({ orderId: created.id, stateId: state.id });

		// Le panier est consommé : le conserver le ferait réapparaître au client.
		await tx.delete(cartItem).where(eq(cartItem.cartId, input.cartId));

		return created;
	});
}

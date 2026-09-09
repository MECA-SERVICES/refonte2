/**
 * Expédition d'une commande — CDC section 21, règles R12 et R13.
 *
 * L'opérateur vérifie le poids et les dimensions réels, puis déclenche la
 * création du colis : Sendcloud renvoie l'étiquette, le numéro et le lien de
 * suivi, enregistrés sur la commande.
 */

import { eq } from 'drizzle-orm';
import { db } from './db';
import { order } from './db/order.schema';
import { createShipment, type SenderAddress } from './sendcloud';

/** Expéditeur de tous les colis : l'atelier de Carantilly. */
const SENDER: SenderAddress = {
	name: 'MS Shop',
	companyName: 'Mecaservices',
	addressLine1: '4 La Merrerie',
	houseNumber: '4',
	postalCode: '50570',
	city: 'Carantilly',
	countryCode: 'FR',
	email: 'tech.mecaservicesshop@gmail.com',
	phone: '+33950922336'
};

/** Adresse figée sur la commande au moment de l'achat. */
type FrozenAddress = {
	firstName?: string;
	lastName?: string;
	company?: string | null;
	line1?: string;
	line2?: string | null;
	postalCode?: string;
	city?: string;
	country?: string;
	phone?: string | null;
};

export class FulfillmentError extends Error {}

/**
 * Crée le colis chez Sendcloud et enregistre le suivi sur la commande.
 *
 * Le code d'offre retenu à la commande est rejoué tel quel : c'est ce que le
 * client a choisi et payé. L'opérateur peut le remplacer — cas d'une commande
 * passée avec la grille de repli, où le transporteur restait à arbitrer (R20).
 */
export async function shipOrder(input: {
	orderId: number;
	weightKg: number;
	dimensionsCm?: { length: number; width: number; height: number };
	/** Remplace l'offre retenue à la commande, si l'opérateur en choisit une autre. */
	overrideOptionCode?: string;
}) {
	const [found] = await db.select().from(order).where(eq(order.id, input.orderId)).limit(1);
	if (!found) throw new FulfillmentError('Commande introuvable.');
	if (found.sendcloudParcelId) throw new FulfillmentError('Un colis existe déjà pour cette commande.');

	const optionCode = input.overrideOptionCode ?? found.shippingOptionCode;
	if (!optionCode) {
		throw new FulfillmentError(
			"Aucun mode de livraison n'est associé à cette commande : choisissez un transporteur."
		);
	}

	const to = (found.shippingAddress ?? {}) as FrozenAddress;
	if (!to.line1 || !to.postalCode || !to.city) {
		throw new FulfillmentError('Adresse de livraison incomplète.');
	}

	const shipment = await createShipment({
		orderReference: found.reference,
		shippingOptionCode: optionCode,
		fromAddress: SENDER,
		name: `${to.firstName ?? ''} ${to.lastName ?? ''}`.trim(),
		companyName: to.company ?? null,
		addressLine1: to.line1,
		addressLine2: to.line2 ?? null,
		postalCode: to.postalCode,
		city: to.city,
		countryCode: to.country ?? 'FR',
		phone: to.phone ?? null,
		weightKg: input.weightKg,
		dimensionsCm: input.dimensionsCm,
		// Le point relais retenu à la commande doit être repris à l'expédition.
		servicePointId: found.relayPointId ? Number(found.relayPointId) : null
	});

	await db
		.update(order)
		.set({
			sendcloudShipmentId: shipment.shipmentId,
			sendcloudParcelId: shipment.parcelId,
			trackingNumber: shipment.trackingNumber,
			trackingUrl: shipment.trackingUrl,
			labelUrl: shipment.labelUrl,
			shippingOptionCode: optionCode,
			packageWeightKg: input.weightKg.toFixed(3),
			packageLengthCm: input.dimensionsCm?.length.toFixed(2),
			packageWidthCm: input.dimensionsCm?.width.toFixed(2),
			packageHeightCm: input.dimensionsCm?.height.toFixed(2),
			lastTrackingUpdate: new Date(),
			updatedAt: new Date()
		})
		.where(eq(order.id, input.orderId));

	return shipment;
}

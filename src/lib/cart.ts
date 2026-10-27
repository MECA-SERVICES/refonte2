/**
 * Totaux du panier — métier pur, partagé client/serveur.
 *
 * Le serveur ($lib/server/cart) et l'affichage optimiste du panier utilisent le
 * MÊME calcul : aucun écart ne peut apparaître entre le récapitulatif affiché
 * et la réponse du serveur.
 */

import { effectiveTaxRate, type TaxRegime } from '$lib/tax';
import { round2 } from '$lib/money';

/**
 * Quantité maximale d'un article dans le panier.
 *
 * Le stock ne plafonne plus la quantité : ce qui manque est commandé chez le
 * fabricant (décision du 27/10/2026). La borne évite seulement une saisie
 * aberrante.
 */
export const MAX_LINE_QUANTITY = 999;

/**
 * Un article désactivé, ou réservé à la vente à l'atelier, bloque le passage
 * en commande (règle R7). Un article en rupture reste commandable : il est
 * « sur commande », comme 99,6 % du catalogue (décision du 27/10/2026).
 */
export function isCartLineBlocking(line: { isActive: boolean; availableForOrder: boolean }) {
	return !line.isActive || !line.availableForOrder;
}

/** Ce qu'une ligne doit porter pour entrer dans le calcul des totaux. */
export type TotalableLine = {
	priceHt: string | number;
	quantity: number;
	taxRate: string | null;
};

export type CartTotals = {
	subtotalHt: number;
	tax: number;
	totalTtc: number;
	itemCount: number;
};

/**
 * Totaux du panier. Les prix retenus sont ceux en vigueur (règle R10).
 *
 * La TVA est recalculée à partir du taux du produit et du régime du client, et
 * non déduite de l'écart TTC/HT : le TTC issu de la requête suppose toujours le
 * régime standard, ce qui facturerait la taxe à un client exonéré (CDC 23,
 * R1-R2). Le taux variant d'un article à l'autre, le calcul reste ligne à ligne.
 */
export function computeCartTotals(
	lines: TotalableLine[],
	regime: TaxRegime = 'standard'
): CartTotals {
	let subtotalHt = 0;
	let tax = 0;
	let itemCount = 0;

	for (const line of lines) {
		const lineHt = Number(line.priceHt) * line.quantity;
		subtotalHt += lineHt;
		tax += lineHt * (effectiveTaxRate(line.taxRate, regime) / 100);
		itemCount += line.quantity;
	}

	const ht = round2(subtotalHt);
	const tva = round2(tax);
	return {
		subtotalHt: ht,
		tax: tva,
		totalTtc: round2(ht + tva),
		itemCount
	};
}

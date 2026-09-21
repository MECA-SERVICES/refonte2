/**
 * Fondations monétaires — arrondi, formatage, passage HT → TTC.
 *
 * Module partagé client/serveur, sans accès base. C'est LA destination de tout
 * helper d'argent : avant d'en écrire un ailleurs, vérifier qu'il n'est pas ici.
 */

/**
 * Arrondi au centime — les montants monétaires ne portent que deux décimales.
 *
 * `Number.EPSILON` compense les représentations flottantes limites
 * (1.005 * 100 vaut 100.49999… : sans epsilon, l'arrondi tomberait à 1.00).
 */
export function round2(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Prix TTC à partir d'un prix HT et d'un taux de TVA (%), arrondi au centime. */
export function computeTtc(priceHt: string | number, rate: string | number): number {
	return round2(Number(priceHt) * (1 + Number(rate) / 100));
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eurWhole = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
	maximumFractionDigits: 0
});
const grouped = new Intl.NumberFormat('fr-FR');

/** Formate un prix (chaîne numeric SQL ou nombre) en euros : « 1 234,56 € ». */
export function formatPrice(value: string | number): string {
	return eur.format(Number(value));
}

/** Prix sans centimes — axes de graphiques et indicateurs : « 1 235 € ». */
export function formatPriceRounded(value: string | number): string {
	return eurWhole.format(Number(value));
}

/** Nombre avec séparateurs de milliers français : « 12 345 ». */
export function formatNumber(value: string | number): string {
	return grouped.format(Number(value));
}

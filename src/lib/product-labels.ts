/**
 * Étiquettes produit, au gabarit de la « Génération étiquette » du module
 * Dolibarr « UTILE » (`dep/format.php`) : 62 × 32 mm, logo, code-barres
 * EAN-13, désignation et référence.
 *
 * Le prix TTC n'est imprimé que pour un produit rangé dans un emplacement de
 * vente (le MAGASIN, `stock_location.price_on_label`) : ailleurs, l'étiquette
 * sert à retrouver la pièce, pas à la vendre.
 *
 * Fonctions pures, partagées par le PDF et ses tests.
 */

/** Longueur d'une ligne de désignation sur l'étiquette (`$max_cara` d'UTILE). */
const LINE_LENGTH = 48;

export type LabelProduct = {
	name: string;
	reference: string;
	ean13: string | null;
	/** Prix de vente TTC. */
	priceTtc: number;
	/** Rangé dans un emplacement de vente : le prix figure sur l'étiquette. */
	withPrice: boolean;
};

/**
 * Textes de l'étiquette, comme UTILE : désignation en minuscules sur une ou
 * deux lignes de 48 caractères (la seconde se termine par un point), puis
 * « Référence : … », puis le prix TTC s'il doit figurer.
 */
export function labelTexts(product: LabelProduct) {
	const name = product.name.toLowerCase();
	const lines = [name.slice(0, LINE_LENGTH)];
	if (name.length > LINE_LENGTH) lines.push(`${name.slice(LINE_LENGTH, LINE_LENGTH * 2)}.`);
	return {
		lines,
		reference: `Référence : ${product.reference}`,
		price: product.withPrice ? `${product.priceTtc.toFixed(2).replace('.', ',')} € TTC` : null
	};
}

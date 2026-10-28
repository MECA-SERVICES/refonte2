/**
 * Codes-barres EAN-13 des étiquettes produit, sans dépendance : les barres
 * sont dessinées en vectoriel dans le PDF (`$lib/server/product-label-pdf`).
 *
 * Même règle que la génération d'étiquettes du module Dolibarr « UTILE »
 * (`rectifCodeBarre`) : un EAN de 13 chiffres au chiffre de contrôle faux est
 * corrigé sur l'étiquette, jamais dans les données.
 */

/** Chiffre de contrôle des 12 premiers chiffres (pondération 1, 3, 1, 3…). */
export function ean13CheckDigit(first12: string): number {
	const sum = [...first12].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
	return (10 - (sum % 10)) % 10;
}

/**
 * EAN imprimable : 13 chiffres, chiffre de contrôle recalculé. null si le code
 * n'a pas 13 chiffres (pas de code-barres sur l'étiquette, comme dans UTILE).
 */
export function printableEan13(raw: string | null | undefined): string | null {
	const code = (raw ?? '').trim();
	if (!/^\d{13}$/.test(code)) return null;
	return code.slice(0, 12) + ean13CheckDigit(code.slice(0, 12));
}

/** Vrai si le chiffre de contrôle est juste (sinon l'écran le signale en rouge). */
export function isValidEan13(raw: string | null | undefined): boolean {
	const code = (raw ?? '').trim();
	return /^\d{13}$/.test(code) && printableEan13(code) === code;
}

// Jeux de codage EAN-13 : L (impair), G (pair), R (droite).
const L = [
	'0001101',
	'0011001',
	'0010011',
	'0111101',
	'0100011',
	'0110001',
	'0101111',
	'0111011',
	'0110111',
	'0001011'
];
const G = [
	'0100111',
	'0110011',
	'0011011',
	'0100001',
	'0011101',
	'0111001',
	'0000101',
	'0010001',
	'0001001',
	'0010111'
];
const R = [
	'1110010',
	'1100110',
	'1101100',
	'1000010',
	'1011100',
	'1001110',
	'1010000',
	'1000100',
	'1001000',
	'1110100'
];
/** Le premier chiffre choisit L ou G pour chacun des six chiffres de gauche. */
const PARITY = [
	'LLLLLL',
	'LLGLGG',
	'LLGGLG',
	'LLGGGL',
	'LGLLGG',
	'LGGLLG',
	'LGGGLL',
	'LGLGLG',
	'LGLGGL',
	'LGGLGL'
];

/** Les 95 modules du code (« 1 » = barre), gardes comprises. */
export function ean13Modules(code: string): string {
	const digits = [...code].map(Number);
	const parity = PARITY[digits[0]];
	const left = digits
		.slice(1, 7)
		.map((d, i) => (parity[i] === 'L' ? L[d] : G[d]))
		.join('');
	const right = digits
		.slice(7)
		.map((d) => R[d])
		.join('');
	return `101${left}01010${right}101`;
}

/**
 * Barres à dessiner : position et largeur en modules, et si la barre est une
 * garde (plus longue, comme sur un code imprimé).
 */
export function ean13Bars(code: string): { x: number; width: number; guard: boolean }[] {
	const modules = ean13Modules(code);
	const isGuard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
	const bars: { x: number; width: number; guard: boolean }[] = [];
	for (let i = 0; i < modules.length; i++) {
		if (modules[i] !== '1') continue;
		const last = bars.at(-1);
		if (last && last.x + last.width === i && last.guard === isGuard(i)) last.width++;
		else bars.push({ x: i, width: 1, guard: isGuard(i) });
	}
	return bars;
}

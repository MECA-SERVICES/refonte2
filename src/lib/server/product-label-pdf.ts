import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Content } from 'pdfmake/interfaces';
import { ean13Bars, printableEan13 } from '$lib/ean13';
import { labelTexts, type LabelProduct } from '$lib/product-labels';
import { renderPdf } from './pdf';

/**
 * Étiquettes produit en PDF, une par page de 62 × 32 mm, au gabarit de la
 * « Génération étiquette » du module Dolibarr « UTILE » : logo MSShop en haut
 * à gauche (cadre 3, 3, 27 × 11 mm), EAN-13 en haut à droite (30, 1,
 * 30 × 14 mm), puis désignation, référence et, au magasin, prix TTC.
 * Positions reprises de `format.php`.
 */

/** Millimètres → points PDF. */
const mm = (value: number) => (value * 72) / 25.4;

const LOGO = `data:image/png;base64,${readFileSync(
	path.join(process.cwd(), 'static', 'logo-msshop.png')
).toString('base64')}`;

/** Code-barres vectoriel : barres, gardes plus longues, chiffres dessous. */
function barcode(code: string): Content[] {
	const left = 30;
	const top = 1;
	// 95 modules plus la place du premier chiffre, sur 30 mm.
	const module = 30 / 102;
	const start = left + 7 * module;
	const bars = ean13Bars(code).map((b) => ({
		type: 'rect' as const,
		x: mm(start + b.x * module),
		y: mm(top),
		w: mm(b.width * module),
		h: mm(b.guard ? 12 : 10.8),
		color: 'black'
	}));
	const digits = (text: string, from: number, width: number): Content => ({
		absolutePosition: { x: mm(from), y: mm(top + 10.9) },
		columns: [
			{
				width: mm(width),
				text,
				fontSize: 6,
				bold: true,
				characterSpacing: 1.2,
				alignment: 'center'
			}
		]
	});
	return [
		{ canvas: bars, absolutePosition: { x: 0, y: 0 } },
		digits(code[0], left, 7 * module),
		digits(code.slice(1, 7), start + 3 * module, 42 * module),
		digits(code.slice(7), start + 50 * module, 42 * module)
	];
}

/** Une étiquette : contenu positionné sur sa page. */
function label(product: LabelProduct, first: boolean): Content[] {
	const texts = labelTexts(product);
	const ean = printableEan13(product.ean13);
	// Sans prix, le texte descend de 3 mm, comme le modèle « Sans prix » d'UTILE.
	const shift = texts.price ? 0 : 1.5;
	// Une colonne de largeur fixe : le texte ne déborde jamais de l'étiquette.
	const line = (text: string, y: number, fontSize: number, center = false): Content => ({
		absolutePosition: { x: mm(center ? 0 : 1.5), y: mm(y + shift) },
		columns: [
			{
				width: mm(center ? 62 : 60),
				text,
				fontSize,
				bold: true,
				alignment: center ? 'center' : 'left'
			}
		]
	});
	return [
		// Les éléments positionnés ne créent pas de page : un saut explicite le fait.
		...(first ? [] : [{ text: '', pageBreak: 'before' as const }]),
		// Logo MSShop dans le cadre du logo UTILE, proportions conservées.
		{ image: 'logo', fit: [mm(27), mm(11)], absolutePosition: { x: mm(3), y: mm(3) } },
		...(ean ? barcode(ean) : []),
		...texts.lines.map((text, i) => line(text, 15.3 + i * 3, 7)),
		line(texts.reference, 21.9, 9),
		...(texts.price ? [line(texts.price, 26.2, 10, true)] : [])
	];
}

/** Planche d'étiquettes : une page par exemplaire, dans l'ordre donné. */
export function renderProductLabels(products: LabelProduct[]) {
	return renderPdf({
		pageSize: { width: mm(62), height: mm(32) },
		pageMargins: 0,
		defaultStyle: { font: 'Roboto', lineHeight: 1 },
		info: { title: 'Étiquettes produit' },
		// Déclaré une fois : le logo n'est embarqué qu'une fois pour toute la planche.
		images: { logo: LOGO },
		content: products.flatMap((p, i) => label(p, i === 0))
	});
}

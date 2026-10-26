import pdfmake from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import path from 'node:path';

/**
 * Socle commun des documents PDF du back-office : polices, couleurs, tableaux.
 *
 * pdfmake plutôt qu'un rendu HTML headless : générer un document ne doit pas
 * demander un Chromium sur le serveur de production.
 */

const FONT_DIR = path.join(process.cwd(), 'static', 'fonts', 'roboto');

let fontsReady = false;

/** Déclare les polices une seule fois par processus. */
function ensureFonts() {
	if (fontsReady) return;

	pdfmake.addFonts({
		Roboto: {
			normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
			bold: path.join(FONT_DIR, 'Roboto-Medium.ttf'),
			italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
			bolditalics: path.join(FONT_DIR, 'Roboto-MediumItalic.ttf')
		}
	});

	// Un document ne charge rien d'extérieur : on ferme les accès que pdfmake
	// ouvrirait sinon. Seules les polices embarquées sont lisibles.
	pdfmake.setUrlAccessPolicy?.(() => false);
	pdfmake.setLocalAccessPolicy?.((target: string) => path.resolve(target).startsWith(FONT_DIR));

	pdfmake.addTableLayouts(PDF_TABLE_LAYOUTS);

	fontsReady = true;
}

/** Charte : bleu de la boutique, gris des libellés. */
export const PDF_COLORS = {
	blue: '#314192',
	ink: '#1e2436',
	muted: '#6b7280',
	rule: '#d7dbe4'
} as const;

/** Filets discrets, en-têtes sur fond clair. */
export const PDF_TABLE_LAYOUTS = {
	msTable: {
		hLineWidth: () => 0.7,
		vLineWidth: () => 0,
		hLineColor: () => PDF_COLORS.rule,
		fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f3f5f9' : null),
		paddingLeft: () => 6,
		paddingRight: () => 6,
		paddingTop: () => 5,
		paddingBottom: () => 5
	},
	msTotals: {
		hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
			i === node.table.body.length - 1 || i === node.table.body.length ? 0.7 : 0,
		vLineWidth: () => 0,
		hLineColor: () => PDF_COLORS.rule,
		paddingLeft: () => 6,
		paddingRight: () => 6,
		paddingTop: () => 4,
		paddingBottom: () => 4
	}
};

/** Montant en euros, avec ses polices : « 1 234,56 € ». */
export const pdfEuro = (n: number) =>
	`${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} €`;

/** Date courte : « 26/10/2026 », ou « — ». */
export const pdfShortDate = (d: Date | string | null | undefined) =>
	d ? new Intl.DateTimeFormat('fr-FR').format(new Date(d)) : '—';

/** Rend une définition pdfmake en PDF. */
export async function renderPdf(definition: TDocumentDefinitions): Promise<Buffer> {
	ensureFonts();
	const buffer = await pdfmake.createPdf(definition).getBuffer();
	return Buffer.from(buffer);
}

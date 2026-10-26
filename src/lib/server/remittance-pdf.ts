import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { COMPANY } from './invoicing';
import { PDF_COLORS, pdfEuro as euro, pdfShortDate as shortDate, renderPdf } from './pdf';
import { payerName } from '$lib/settlements';
import type { getRemittance } from './settlements';

/**
 * Bordereau de remise en banque (demande client 1.2), sur le modèle du
 * bordereau Dolibarr `CHK2609-0089` : en-tête (compte, date, nombre, total),
 * puis une ligne par règlement.
 */

type RemittanceDocument = NonNullable<Awaited<ReturnType<typeof getRemittance>>>;

const { blue: BLUE, ink: INK, muted: MUTED } = PDF_COLORS;

function buildDefinition(doc: RemittanceDocument): TDocumentDefinitions {
	const isCheque = doc.kind === 'cheque';
	const title = isCheque ? 'BORDEREAU DE REMISE DE CHÈQUES' : 'BORDEREAU DE REMISE D’ESPÈCES';

	const head: TableCell[] = [
		{ text: 'N°', style: 'th' },
		{ text: 'Reçu le', style: 'th' },
		...(isCheque
			? [
					{ text: 'N° de chèque', style: 'th' },
					{ text: 'Émetteur', style: 'th' },
					{ text: 'Banque', style: 'th' }
				]
			: [{ text: 'Client', style: 'th' }]),
		{ text: 'Règlement', style: 'th' },
		{ text: 'Montant', style: 'th', alignment: 'right' }
	];

	const rows: TableCell[][] = doc.lines.map((line, i) => [
		{ text: String(i + 1), style: 'td' },
		{ text: shortDate(line.receivedOn), style: 'td' },
		...(isCheque
			? [
					{ text: line.chequeNumber ?? '—', style: 'td' },
					{ text: payerName(line), style: 'td' },
					{ text: line.chequeBank ?? '—', style: 'td' }
				]
			: [{ text: payerName(line), style: 'td' }]),
		{
			text: line.repairReference ? `${line.reference}\n${line.repairReference}` : line.reference,
			style: 'td'
		},
		{ text: euro(Number(line.amount)), style: 'td', alignment: 'right' }
	]);

	const widths = isCheque ? [18, 52, 70, '*', 70, 82, 62] : [18, 52, '*', 82, 62];

	const body: Content[] = [
		// ---- En-tête ----
		{
			columns: [
				{
					stack: [
						{ text: COMPANY.name, style: 'brand' },
						{
							text: `${COMPANY.addressLine}\n${COMPANY.postalCode} ${COMPANY.city}`,
							style: 'muted'
						}
					]
				},
				{
					width: 'auto',
					alignment: 'right',
					stack: [
						{ text: title, style: 'docTitle' },
						{ text: doc.reference, style: 'docNumber' }
					]
				}
			]
		},

		// ---- Récapitulatif ----
		{
			table: {
				widths: ['*', '*', '*', '*', '*'],
				body: [
					[
						{ text: 'Compte bancaire', style: 'th' },
						{ text: 'Date de remise', style: 'th' },
						{ text: isCheque ? 'Nombre de chèques' : 'Nombre de règlements', style: 'th' },
						{ text: 'Total', style: 'th' },
						{ text: 'Statut', style: 'th' }
					],
					[
						{ text: doc.bankAccount, style: 'td' },
						{ text: shortDate(doc.depositedOn), style: 'td' },
						{ text: String(doc.settlementCount), style: 'td' },
						{ text: euro(Number(doc.total)), style: 'td', bold: true },
						{ text: 'Validé', style: 'td' }
					]
				]
			},
			layout: 'msTable',
			margin: [0, 24, 0, 0]
		},

		// ---- Lignes ----
		{
			table: { headerRows: 1, widths, body: [head, ...rows] },
			layout: 'msTable',
			margin: [0, 18, 0, 0]
		},

		// ---- Total ----
		{
			columns: [
				{ text: '' },
				{
					width: 'auto',
					table: {
						body: [
							[
								{ text: 'Total de la remise', style: 'grandLabel' },
								{ text: euro(Number(doc.total)), style: 'grandValue' }
							]
						]
					},
					layout: 'msTotals'
				}
			],
			margin: [0, 12, 0, 0]
		},

		// ---- Signature ----
		{
			columns: [
				{ text: '' },
				{
					width: 200,
					stack: [
						{ text: 'Signature du déposant', style: 'blockTitle' },
						{
							canvas: [
								{
									type: 'rect',
									x: 0,
									y: 0,
									w: 200,
									h: 60,
									lineColor: PDF_COLORS.rule
								}
							]
						}
					]
				}
			],
			margin: [0, 36, 0, 0]
		}
	];

	return {
		pageSize: 'A4',
		pageMargins: [40, 40, 40, 60],
		content: body,
		defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
		styles: {
			brand: { fontSize: 15, bold: true, color: BLUE, margin: [0, 0, 0, 3] },
			docTitle: { fontSize: 14, bold: true, color: INK },
			docNumber: { fontSize: 12, bold: true, color: BLUE, margin: [0, 2, 0, 0] },
			blockTitle: { fontSize: 9, bold: true, margin: [0, 0, 0, 4] },
			th: { fontSize: 8, bold: true, color: INK },
			td: { fontSize: 8.5 },
			muted: { fontSize: 8.5, color: MUTED },
			grandLabel: { fontSize: 11, bold: true, alignment: 'right', color: BLUE },
			grandValue: { fontSize: 11, bold: true, alignment: 'right', color: BLUE }
		},
		footer: (page, pages) => ({
			text: `${COMPANY.legalName} · SIREN ${COMPANY.siren} · ${doc.reference} · page ${page}/${pages}`,
			alignment: 'center',
			fontSize: 7.5,
			color: MUTED,
			margin: [40, 20, 40, 0]
		}),
		info: { title: `Bordereau ${doc.reference}`, author: COMPANY.name }
	};
}

/** Rend le bordereau en PDF. */
export function renderRemittancePdf(doc: RemittanceDocument): Promise<Buffer> {
	return renderPdf(buildDefinition(doc));
}

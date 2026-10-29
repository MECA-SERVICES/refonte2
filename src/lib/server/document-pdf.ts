import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { COMPANY } from '$lib/company';
import type { CounterBillingAddress, CounterTaxLine } from './db/counter-invoice.schema';
import { PDF_COLORS, pdfEuro as euro, pdfShortDate as shortDate } from './pdf';

/**
 * Document commercial du comptoir en PDF — facture, avoir ou devis — sur la
 * présentation des factures du site (`invoice-pdf.ts`) : en-tête, client,
 * lignes avec remise, détail des taxes, totaux. Chaque document y ajoute ses
 * propres lignes de totaux et son pied (règlements, bon pour accord…).
 */

const { blue: BLUE, ink: INK, muted: MUTED } = PDF_COLORS;

export type DocumentLine = {
	reference: string | null;
	label: string;
	taxRate: string;
	unitPriceHt: string;
	quantity: string;
	discountPercent: string;
	totalHt: string;
};

export type CommercialDocument = {
	/** « FACTURE », « AVOIR », « DEVIS », « BROUILLON »… */
	title: string;
	number: string;
	date: string | Date;
	/** Mentions sous l'en-tête, à gauche : facture corrigée, ordre de réparation, validité. */
	mentions: string[];
	/** Adresse figée, sinon le client tel qu'il est enregistré. */
	billingAddress: CounterBillingAddress | null;
	customer: {
		companyName: string | null;
		firstName: string | null;
		lastName: string | null;
		phone: string | null;
		email: string | null;
	};
	lines: DocumentLine[];
	taxBreakdown: CounterTaxLine[];
	totalHt: string;
	totalTva: string;
	totalTtc: string;
	/** Lignes ajoutées sous le total TTC : [libellé, montant, en gras]. */
	extraTotals: [string, number, boolean][];
	/** Contenu après les totaux : règlements, notes, mentions légales, signature. */
	after: Content[];
	/** Titre des métadonnées du fichier (« Facture FA2610-1315 »). */
	fileTitle: string;
};

/** Destinataire : adresse figée, sinon les coordonnées du client. */
function recipient(doc: CommercialDocument): string {
	const a = doc.billingAddress;
	const c = doc.customer;
	const lines = a
		? [
				a.company,
				a.name,
				a.line1,
				a.line2,
				[a.postalCode, a.city].filter(Boolean).join(' '),
				a.phone,
				a.email
			]
		: [c.companyName, `${c.firstName ?? ''} ${c.lastName ?? ''}`, c.phone, c.email];
	return lines
		.map((v) => (v ?? '').toString().trim())
		.filter(Boolean)
		.join('\n');
}

const quantity = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

export function documentDefinition(doc: CommercialDocument): TDocumentDefinitions {
	const a = doc.billingAddress;
	const body: Content[] = [
		{
			columns: [
				{
					stack: [
						{ text: COMPANY.name, style: 'brand' },
						{
							text: `${COMPANY.addressLine}\n${COMPANY.postalCode} ${COMPANY.city}\n${COMPANY.phone}`,
							style: 'muted'
						}
					]
				},
				{
					width: 'auto',
					alignment: 'right' as const,
					stack: [
						{ text: doc.title, style: 'docTitle' },
						{ text: doc.number, style: 'docNumber' },
						{ text: `Date : ${shortDate(doc.date)}`, style: 'muted' }
					]
				}
			]
		},
		{
			columns: [
				{ stack: doc.mentions.map((text) => ({ text, style: 'muted' })) },
				{
					width: 230,
					stack: [
						{ text: 'Client', style: 'blockTitle' },
						{ text: recipient(doc), style: 'address' },
						...(a?.siret ? [{ text: `SIRET : ${a.siret}`, style: 'muted' }] : []),
						...(a?.vatNumber ? [{ text: `N° TVA : ${a.vatNumber}`, style: 'muted' }] : [])
					]
				}
			],
			margin: [0, 24, 0, 0]
		},
		{
			table: {
				headerRows: 1,
				widths: [70, '*', 32, 58, 38, 34, 60],
				body: [
					[
						{ text: 'Référence', style: 'th' },
						{ text: 'Désignation', style: 'th' },
						{ text: 'TVA', style: 'th', alignment: 'right' as const },
						{ text: 'P.U. HT', style: 'th', alignment: 'right' as const },
						{ text: 'Qté', style: 'th', alignment: 'right' as const },
						{ text: 'Rem.', style: 'th', alignment: 'right' as const },
						{ text: 'Total HT', style: 'th', alignment: 'right' as const }
					],
					...doc.lines.map((l) => [
						{ text: l.reference ?? '', style: 'td' },
						{ text: l.label, style: 'td' },
						{ text: `${Number(l.taxRate)} %`, style: 'td', alignment: 'right' as const },
						{ text: euro(Number(l.unitPriceHt)), style: 'td', alignment: 'right' as const },
						{ text: quantity(Number(l.quantity)), style: 'td', alignment: 'right' as const },
						{
							text: Number(l.discountPercent) ? `${Number(l.discountPercent)} %` : '',
							style: 'td',
							alignment: 'right' as const
						},
						{ text: euro(Number(l.totalHt)), style: 'td', alignment: 'right' as const }
					])
				]
			},
			layout: 'msTable',
			margin: [0, 22, 0, 0]
		},
		{
			columns: [
				{
					width: '52%',
					table: {
						headerRows: 1,
						widths: ['*', 60, 60],
						body: [
							[
								{ text: 'Taux de TVA', style: 'th' },
								{ text: 'Base HT', style: 'th', alignment: 'right' as const },
								{ text: 'TVA', style: 'th', alignment: 'right' as const }
							],
							...doc.taxBreakdown.map((t) => [
								{ text: `${t.rate} %`, style: 'td' },
								{ text: euro(t.baseHt), style: 'td', alignment: 'right' as const },
								{ text: euro(t.taxAmount), style: 'td', alignment: 'right' as const }
							])
						]
					},
					layout: 'msTable'
				},
				{ width: 12, text: '' },
				{
					width: '*',
					table: {
						widths: ['*', 80],
						body: [
							[
								{ text: 'Total HT', style: 'totalLabelStrong' },
								{ text: euro(Number(doc.totalHt)), style: 'totalValueStrong' }
							],
							[
								{ text: 'TVA', style: 'totalLabelStrong' },
								{ text: euro(Number(doc.totalTva)), style: 'totalValueStrong' }
							],
							[
								{ text: 'Total TTC', style: 'grandLabel' },
								{ text: euro(Number(doc.totalTtc)), style: 'grandValue' }
							],
							...doc.extraTotals.map(([label, amount, strong]) => [
								{ text: label, style: strong ? 'totalLabelStrong' : 'totalLabel' },
								{ text: euro(amount), style: strong ? 'totalValueStrong' : 'totalValue' }
							])
						]
					},
					layout: 'msTotals'
				}
			],
			margin: [0, 18, 0, 0]
		},
		...doc.after
	];

	return {
		pageSize: 'A4',
		pageMargins: [40, 40, 40, 72],
		content: body,
		defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
		styles: {
			brand: { fontSize: 15, bold: true, color: BLUE, margin: [0, 0, 0, 3] },
			docTitle: { fontSize: 20, bold: true, color: INK },
			docNumber: { fontSize: 12, bold: true, color: BLUE },
			blockTitle: { fontSize: 10, bold: true, margin: [0, 0, 0, 4] },
			address: { fontSize: 9, lineHeight: 1.25 },
			th: { fontSize: 8, bold: true, color: INK },
			td: { fontSize: 8.5 },
			muted: { fontSize: 8.5, color: MUTED },
			totalLabel: { fontSize: 9, alignment: 'right' as const, color: MUTED },
			totalValue: { fontSize: 9, alignment: 'right' as const },
			totalLabelStrong: { fontSize: 9, bold: true, alignment: 'right' as const },
			totalValueStrong: { fontSize: 9, bold: true, alignment: 'right' as const },
			grandLabel: { fontSize: 12, bold: true, alignment: 'right' as const, color: BLUE },
			grandValue: { fontSize: 12, bold: true, alignment: 'right' as const, color: BLUE }
		},
		footer: () => ({
			stack: [
				{
					text: `${COMPANY.name} - ${COMPANY.addressLine} - ${COMPANY.postalCode} ${COMPANY.city} - ${COMPANY.country}`,
					alignment: 'center' as const,
					fontSize: 7.5,
					color: MUTED
				},
				{
					text: `${COMPANY.legalName} / ${COMPANY.rcs} / Siren : ${COMPANY.siren} / TVA intracommunautaire : ${COMPANY.vatNumber}`,
					alignment: 'center' as const,
					fontSize: 7.5,
					color: MUTED
				}
			],
			margin: [40, 12, 40, 0]
		}),
		info: { title: doc.fileTitle, author: COMPANY.name }
	};
}

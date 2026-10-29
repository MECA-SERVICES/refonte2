import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { COMPANY } from '$lib/company';
import type { getCounterInvoice } from './counter-invoices';
import { PDF_COLORS, pdfEuro as euro, pdfShortDate as shortDate, renderPdf } from './pdf';

/**
 * Facture comptoir ou avoir en PDF, sur la présentation des factures du site
 * (`invoice-pdf.ts`) : en-tête, client, lignes avec remise, détail des taxes,
 * totaux, règlements et reste à payer.
 */

const { blue: BLUE, ink: INK, muted: MUTED } = PDF_COLORS;

type Doc = NonNullable<Awaited<ReturnType<typeof getCounterInvoice>>>;

const quantity = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

function buildDefinition(doc: Doc): TDocumentDefinitions {
	const { invoice, lines, settlements, paid, credited, remaining } = doc;
	const isCredit = invoice.kind === 'credit_note';
	const title =
		invoice.status === 'draft'
			? isCredit
				? 'AVOIR (BROUILLON)'
				: 'BROUILLON'
			: isCredit
				? 'AVOIR'
				: 'FACTURE';
	const number = invoice.number ?? `Brouillon n° ${invoice.id}`;
	const date = invoice.issuedOn ?? invoice.createdAt;
	const a = invoice.billingAddress;
	const client = a
		? [
				a.company,
				a.name,
				a.line1,
				a.line2,
				[a.postalCode, a.city].filter(Boolean).join(' '),
				a.phone,
				a.email
			]
		: [
				doc.customer.companyName,
				`${doc.customer.firstName} ${doc.customer.lastName}`,
				doc.customer.phone,
				doc.customer.email
			];
	const breakdown = invoice.taxBreakdown ?? [];

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
						{ text: title, style: 'docTitle' },
						{ text: number, style: 'docNumber' },
						{ text: `Date : ${shortDate(date)}`, style: 'muted' }
					]
				}
			]
		},
		{
			columns: [
				{
					stack: [
						...(doc.creditedInvoice?.number
							? [{ text: `Avoir sur la facture ${doc.creditedInvoice.number}`, style: 'muted' }]
							: []),
						...(doc.repair
							? [{ text: `Ordre de réparation ${doc.repair.reference}`, style: 'muted' }]
							: [])
					]
				},
				{
					width: 230,
					stack: [
						{ text: 'Client', style: 'blockTitle' },
						{
							text: client
								.map((v) => (v ?? '').toString().trim())
								.filter(Boolean)
								.join('\n'),
							style: 'address'
						},
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
					...lines.map((l) => [
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
							...breakdown.map((t) => [
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
								{ text: euro(Number(invoice.totalHt)), style: 'totalValueStrong' }
							],
							[
								{ text: 'TVA', style: 'totalLabelStrong' },
								{ text: euro(Number(invoice.totalTva)), style: 'totalValueStrong' }
							],
							[
								{ text: 'Total TTC', style: 'grandLabel' },
								{ text: euro(Number(invoice.totalTtc)), style: 'grandValue' }
							],
							...(!isCredit && invoice.status !== 'draft'
								? [
										[
											{ text: 'Déjà réglé', style: 'totalLabel' },
											{ text: euro(paid), style: 'totalValue' }
										],
										...(credited
											? [
													[
														{ text: 'Avoirs', style: 'totalLabel' },
														{ text: euro(credited), style: 'totalValue' }
													]
												]
											: []),
										[
											{ text: 'Reste à payer', style: 'totalLabelStrong' },
											{ text: euro(Math.max(0, remaining)), style: 'totalValueStrong' }
										]
									]
								: [])
						]
					},
					layout: 'msTotals'
				}
			],
			margin: [0, 18, 0, 0]
		}
	];

	if (settlements.length) {
		body.push({
			table: {
				widths: [90, 90, '*', 70],
				body: [
					[
						{ text: 'Règlement', style: 'th' },
						{ text: 'Date', style: 'th' },
						{ text: 'Mode', style: 'th' },
						{ text: 'Montant', style: 'th', alignment: 'right' as const }
					],
					...settlements.map((s) => [
						{ text: s.reference, style: 'td' },
						{ text: shortDate(s.receivedOn), style: 'td' },
						{
							text:
								s.method === 'cheque'
									? `Chèque ${s.chequeNumber ?? ''}`
									: ((
											{ cash: 'Espèces', card: 'Carte bancaire', transfer: 'Virement' } as Record<
												string,
												string
											>
										)[s.method] ?? s.method),
							style: 'td'
						},
						{ text: euro(Number(s.amount)), style: 'td', alignment: 'right' as const }
					])
				]
			},
			layout: 'msTable',
			margin: [0, 16, 0, 0]
		});
	}
	if (invoice.note) body.push({ text: invoice.note, style: 'muted', margin: [0, 12, 0, 0] });
	if (!isCredit) {
		body.push({
			text: 'Pénalités de retard : trois fois le taux d’intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €. Pas d’escompte pour paiement anticipé.',
			style: 'muted',
			margin: [0, 12, 0, 0]
		});
	}

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
		info: { title: `${isCredit ? 'Avoir' : 'Facture'} ${number}`, author: COMPANY.name }
	};
}

export function renderCounterInvoicePdf(doc: Doc): Promise<Buffer> {
	return renderPdf(buildDefinition(doc));
}

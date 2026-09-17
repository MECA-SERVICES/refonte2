import pdfmake from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import path from 'node:path';
import { COMPANY, buildTaxBreakdown, formatInvoiceNumber, splitOrderTax } from './invoicing';
import type { getInvoiceDocument } from './invoicing';

/**
 * Rendu PDF d'une facture (CDC 24).
 *
 * pdfmake plutôt qu'un rendu HTML headless : générer une facture ne doit pas
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

	// Un document de facture ne charge rien d'extérieur : on ferme les accès
	// que pdfmake ouvrirait sinon. Seules les polices embarquées sont lisibles.
	pdfmake.setUrlAccessPolicy?.(() => false);
	pdfmake.setLocalAccessPolicy?.((target: string) => path.resolve(target).startsWith(FONT_DIR));

	fontsReady = true;
}

/** Charte : bleu de la boutique, gris des libellés. */
const BLUE = '#314192';
const INK = '#1e2436';
const MUTED = '#6b7280';
const RULE = '#d7dbe4';

const euro = (n: number) =>
	`${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} €`;

const shortDate = (d: Date | string | null | undefined) =>
	d ? new Intl.DateTimeFormat('fr-FR').format(new Date(d)) : '—';

type Address = {
	firstName?: string | null;
	lastName?: string | null;
	company?: string | null;
	line1?: string | null;
	line2?: string | null;
	postalCode?: string | null;
	city?: string | null;
	country?: string | null;
	phone?: string | null;
};

/** Adresse en lignes, les champs vides simplement omis. */
function addressLines(raw: unknown): string[] {
	if (!raw || typeof raw !== 'object') return ['—'];
	const a = raw as Address;
	const name = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();

	return [
		name,
		a.company,
		a.line1,
		a.line2,
		[a.postalCode, a.city].filter(Boolean).join(' ').trim(),
		a.country === 'FR' ? 'France Métropolitaine' : a.country,
		a.phone
	]
		.map((v) => (v ?? '').toString().trim())
		.filter((v) => v.length > 0);
}

type InvoiceDocument = NonNullable<Awaited<ReturnType<typeof getInvoiceDocument>>>;

/** Construit la définition du document. */
function buildDefinition(doc: InvoiceDocument): TDocumentDefinitions {
	const { invoice, order, lines, payment } = doc;

	const totalHt = Number(invoice.totalHt);
	const totalTtc = Number(invoice.totalTtc);

	/*
	 * Les factures reprises de PrestaShop n'ont pas de ventilation enregistrée.
	 * On la reconstitue depuis les totaux de la commande : afficher « Aucune
	 * taxe » sur une facture taxée serait faux.
	 */
	const breakdown =
		invoice.taxBreakdown ??
		(() => {
			const split = splitOrderTax({
				totalHt,
				totalTva: Number(order.totalTva ?? 0),
				shippingTtc: Number(order.shippingFee ?? 0)
			});
			return buildTaxBreakdown(split);
		})();

	const shippingHt = invoice.taxBreakdown
		? Number(invoice.shippingHt)
		: (breakdown.find((l) => l.label === 'Livraison')?.baseHt ?? Number(invoice.shippingHt));

	const totalTax = breakdown.reduce((sum, l) => sum + l.taxAmount, 0);
	const productsHt = totalHt - shippingHt;

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
					alignment: 'right' as const,
					stack: [
						{ text: 'FACTURE', style: 'docTitle' },
						{ text: shortDate(invoice.issuedAt ?? invoice.createdAt), style: 'muted' },
						{ text: formatInvoiceNumber(invoice.number), style: 'docNumber' }
					]
				}
			]
		},

		// ---- Adresses ----
		{
			columns: [
				{
					stack: [
						{ text: 'Adresse de livraison', style: 'blockTitle' },
						{ text: addressLines(order.shippingAddress).join('\n'), style: 'address' }
					]
				},
				{
					stack: [
						{ text: 'Adresse de facturation', style: 'blockTitle' },
						{
							text: addressLines(order.billingAddress ?? order.shippingAddress).join('\n'),
							style: 'address'
						}
					]
				}
			],
			margin: [0, 24, 0, 0]
		},

		// ---- Références ----
		{
			table: {
				widths: ['*', '*', '*', '*'],
				body: [
					[
						{ text: 'Numéro de facture', style: 'th' },
						{ text: 'Date de facturation', style: 'th' },
						{ text: 'Réf. de commande', style: 'th' },
						{ text: 'Date de commande', style: 'th' }
					],
					[
						{
							text: formatInvoiceNumber(invoice.number),
							style: 'td',
							alignment: 'center' as const
						},
						{
							text: shortDate(invoice.issuedAt ?? invoice.createdAt),
							style: 'td',
							alignment: 'center' as const
						},
						{ text: order.reference, style: 'td', alignment: 'center' as const },
						{ text: shortDate(order.createdAt), style: 'td', alignment: 'center' as const }
					]
				]
			},
			layout: 'msTable',
			margin: [0, 22, 0, 0]
		},

		// ---- Lignes ----
		{
			table: {
				headerRows: 1,
				widths: [82, '*', 42, 62, 34, 62],
				body: [
					[
						{ text: 'Référence', style: 'th' },
						{ text: 'Produit', style: 'th' },
						{ text: 'Taux', style: 'th', alignment: 'right' as const },
						{ text: 'Prix unitaire (HT)', style: 'th', alignment: 'right' as const },
						{ text: 'Qté', style: 'th', alignment: 'right' as const },
						{ text: 'Total (HT)', style: 'th', alignment: 'right' as const }
					],
					...lines.map((line) => {
						const lineHt = Number(line.totalHt);
						const lineTtc = Number(line.totalTtc);
						// Taux réellement appliqué à la ligne, et non un taux supposé.
						const rate = lineHt > 0 ? Math.round(((lineTtc - lineHt) / lineHt) * 100) : 0;
						return [
							{ text: line.productReference ?? '—', style: 'td' },
							{ text: line.productName, style: 'td' },
							{ text: `${rate} %`, style: 'td', alignment: 'right' as const },
							{ text: euro(Number(line.unitPriceHt)), style: 'td', alignment: 'right' as const },
							{ text: String(line.quantity), style: 'td', alignment: 'right' as const },
							{ text: euro(lineHt), style: 'td', alignment: 'right' as const }
						];
					})
				]
			},
			layout: 'msTable',
			margin: [0, 14, 0, 0]
		},

		// ---- Détail des taxes + totaux ----
		{
			columns: [
				{
					width: '52%',
					stack: [
						{
							table: {
								headerRows: 1,
								widths: ['*', 52, 60, 60],
								body: [
									[
										{ text: 'Détail des taxes', style: 'th' },
										{ text: 'Taux', style: 'th', alignment: 'right' as const },
										{ text: 'Prix de base', style: 'th', alignment: 'right' as const },
										{ text: 'Taxe totale', style: 'th', alignment: 'right' as const }
									],
									...(breakdown.length > 0
										? breakdown.map((l) => [
												{ text: l.label, style: 'td' },
												{
													text: `${l.rate.toFixed(3)} %`,
													style: 'td',
													alignment: 'right' as const
												},
												{ text: euro(l.baseHt), style: 'td', alignment: 'right' as const },
												{ text: euro(l.taxAmount), style: 'td', alignment: 'right' as const }
											])
										: [[{ text: 'Aucune taxe', style: 'td', colSpan: 4 }, {}, {}, {}]])
								]
							},
							layout: 'msTable'
						}
					]
				},
				{ width: 12, text: '' },
				{
					width: '*',
					table: {
						widths: ['*', 80],
						body: [
							[
								{ text: 'Total produits', style: 'totalLabel' },
								{ text: euro(productsHt), style: 'totalValue' }
							],
							[
								{ text: 'Frais de livraison', style: 'totalLabel' },
								{ text: euro(shippingHt), style: 'totalValue' }
							],
							[
								{ text: 'Total (HT)', style: 'totalLabelStrong' },
								{ text: euro(totalHt), style: 'totalValueStrong' }
							],
							[
								{ text: 'Taxe totale', style: 'totalLabelStrong' },
								{ text: euro(totalTax), style: 'totalValueStrong' }
							],
							[
								{ text: 'Total', style: 'grandLabel' },
								{ text: euro(totalTtc), style: 'grandValue' }
							]
						]
					},
					layout: 'msTotals'
				}
			],
			margin: [0, 18, 0, 0]
		}
	];

	// ---- Paiement et transporteur ----
	const facts: [string, string][] = [];
	if (payment?.method) facts.push(['Moyen de paiement', payment.method]);
	if (order.carrierName) {
		facts.push(['Transporteur', order.carrierName]);
	}
	if (order.trackingNumber) facts.push(['Suivi', order.trackingNumber]);

	if (facts.length > 0) {
		body.push({
			table: {
				widths: [120, '*'],
				body: facts.map(([k, v]) => [
					{ text: k, style: 'th' },
					{ text: v, style: 'td' }
				])
			},
			layout: 'msTable',
			margin: [0, 16, 0, 0]
		});
	}

	// Mention de régime fiscal : obligatoire dès qu'on ne facture pas la TVA (R7).
	if (invoice.taxMention) {
		body.push({ text: invoice.taxMention, style: 'legalMention', margin: [0, 14, 0, 0] });
	}

	if (doc.vatNumber) {
		body.push({ text: `N° TVA client : ${doc.vatNumber}`, style: 'muted', margin: [0, 6, 0, 0] });
	}

	if (invoice.note) {
		body.push({ text: invoice.note, style: 'muted', margin: [0, 10, 0, 0] });
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
			grandValue: { fontSize: 12, bold: true, alignment: 'right' as const, color: BLUE },
			legalMention: { fontSize: 8.5, bold: true, color: INK }
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
					text: `Pour toute assistance : ${COMPANY.phone}`,
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
		info: {
			title: `Facture ${formatInvoiceNumber(invoice.number)}`,
			author: COMPANY.name
		}
	};
}

/** Filets discrets, en-têtes sur fond clair. */
const TABLE_LAYOUTS = {
	msTable: {
		hLineWidth: () => 0.7,
		vLineWidth: () => 0,
		hLineColor: () => RULE,
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
		hLineColor: () => RULE,
		paddingLeft: () => 6,
		paddingRight: () => 6,
		paddingTop: () => 4,
		paddingBottom: () => 4
	}
};

/** Rend la facture en PDF. */
export async function renderInvoicePdf(doc: InvoiceDocument): Promise<Buffer> {
	ensureFonts();
	pdfmake.addTableLayouts(TABLE_LAYOUTS);

	const pdf = pdfmake.createPdf(buildDefinition(doc));
	const buffer = await pdf.getBuffer();
	return Buffer.from(buffer);
}

/** Nom de fichier proposé au téléchargement. */
export function invoiceFileName(number: string): string {
	return `${formatInvoiceNumber(number).replace('#', '')}.pdf`;
}

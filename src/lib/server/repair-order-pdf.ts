import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { COMPANY } from './invoicing';
import { PDF_COLORS, pdfEuro as euro, pdfShortDate as shortDate, renderPdf } from './pdf';
import { REPAIR_STATUS_LABELS, REPAIR_TYPE_LABELS } from '$lib/repairs';
import type { getRepairOrder } from './repairs';

/**
 * Ordre de réparation en PDF (demande client 13.8) : le document remis au
 * client à la prise en charge, et signé à la restitution.
 *
 * La note interne n'y figure jamais (R23) ; la note visible du client, si.
 */

type RepairDocument = NonNullable<Awaited<ReturnType<typeof getRepairOrder>>>;

const { blue: BLUE, ink: INK, muted: MUTED } = PDF_COLORS;

/** Couple libellé / valeur, omis quand la valeur manque. */
function field(label: string, value: string | null | undefined): TableCell[] | null {
	return value?.trim()
		? [
				{ text: label, style: 'label' },
				{ text: value, style: 'td' }
			]
		: null;
}

function fieldsTable(rows: (TableCell[] | null)[]): Content {
	const body = rows.filter((r): r is TableCell[] => r !== null);
	return body.length > 0
		? { table: { widths: [110, '*'], body }, layout: 'noBorders' }
		: { text: '—', style: 'muted' };
}

function buildDefinition(o: RepairDocument): TDocumentDefinitions {
	const c = o.customer;
	const customerName = [c.customerFirstName, c.customerLastName].filter(Boolean).join(' ');
	const isWarranty = o.orderType === 'warranty';

	const parts: Content = o.parts.length
		? {
				table: {
					headerRows: 1,
					widths: ['*', 90, 30, 60, 62],
					body: [
						[
							{ text: 'Désignation', style: 'th' },
							{ text: 'Référence', style: 'th' },
							{ text: 'Qté', style: 'th', alignment: 'right' },
							{ text: 'P.U. HT', style: 'th', alignment: 'right' },
							{ text: 'Total HT', style: 'th', alignment: 'right' }
						],
						...o.parts.map((p): TableCell[] => [
							{ text: p.partName, style: 'td' },
							{ text: p.partReference ?? '—', style: 'td' },
							{ text: String(p.quantity), style: 'td', alignment: 'right' },
							{ text: euro(Number(p.unitPriceHt)), style: 'td', alignment: 'right' },
							{ text: euro(Number(p.totalHt)), style: 'td', alignment: 'right' }
						])
					]
				},
				layout: 'msTable'
			}
		: { text: 'Aucune pièce consommée.', style: 'muted' };

	const totals: TableCell[][] = [
		[
			{ text: 'Frais de diagnostic HT', style: 'totalLabel' },
			{ text: euro(Number(o.diagnosticFee)), style: 'totalValue' }
		],
		[
			{ text: 'Main-d’œuvre HT', style: 'totalLabel' },
			{ text: euro(Number(o.laborAmount)), style: 'totalValue' }
		],
		[
			{ text: 'Pièces HT', style: 'totalLabel' },
			{ text: euro(Number(o.totalPartsHt)), style: 'totalValue' }
		],
		[
			{ text: 'Total HT', style: 'totalLabel', bold: true },
			{ text: euro(Number(o.totalHt)), style: 'totalValue', bold: true }
		],
		[
			{ text: 'TVA', style: 'totalLabel' },
			{ text: euro(Number(o.totalTva)), style: 'totalValue' }
		],
		[
			{ text: isWarranty ? 'Sous garantie' : 'Total TTC', style: 'grandLabel' },
			{ text: euro(Number(o.totalTtc)), style: 'grandValue' }
		]
	];

	const body: Content[] = [
		// ---- En-tête ----
		{
			columns: [
				{
					stack: [
						{ text: COMPANY.name, style: 'brand' },
						{
							text: `${COMPANY.addressLine}\n${COMPANY.postalCode} ${COMPANY.city}\nTél. ${COMPANY.phone}`,
							style: 'muted'
						}
					]
				},
				{
					width: 'auto',
					alignment: 'right',
					stack: [
						{ text: 'ORDRE DE RÉPARATION', style: 'docTitle' },
						{ text: o.reference, style: 'docNumber' },
						{ text: `Reçu le ${shortDate(o.createdAt)}`, style: 'muted' },
						...(o.workshopLabel ? [{ text: `Étiquette ${o.workshopLabel}`, style: 'muted' }] : [])
					]
				}
			]
		},

		// ---- Récapitulatif ----
		{
			table: {
				widths: ['*', '*', '*'],
				body: [
					[
						{ text: 'Prise en charge', style: 'th' },
						{ text: 'État', style: 'th' },
						{ text: isWarranty ? 'Dossier de garantie' : 'Règlement', style: 'th' }
					],
					[
						{ text: REPAIR_TYPE_LABELS[o.orderType], style: 'td' },
						{ text: REPAIR_STATUS_LABELS[o.status], style: 'td' },
						{
							text: isWarranty
								? (o.warrantyReference ?? '—')
								: o.paidAt
									? `Réglé le ${shortDate(o.paidAt)}`
									: 'À régler',
							style: 'td'
						}
					]
				]
			},
			layout: 'msTable',
			margin: [0, 20, 0, 0]
		},

		// ---- Client et machine ----
		{
			columns: [
				{
					stack: [
						{ text: 'Client', style: 'blockTitle' },
						fieldsTable([
							field('Nom', customerName),
							field('Société', c.customerCompany),
							field('E-mail', c.customerEmail),
							field('Téléphone', c.customerPhone)
						])
					]
				},
				{
					stack: [
						{ text: 'Machine', style: 'blockTitle' },
						fieldsTable([
							field('Type', o.machineType),
							field('Marque', o.machineBrand),
							field('Modèle', o.machineModel),
							field('N° de série', o.serialNumber),
							field('Moteur', o.engineModel),
							field('N° de série moteur', o.engineSerialNumber)
						])
					]
				}
			],
			columnGap: 24,
			margin: [0, 20, 0, 0]
		},

		...(o.machineCondition
			? [
					{
						text: 'État constaté à la prise en charge',
						style: 'blockTitle',
						margin: [0, 16, 0, 4]
					},
					{ text: o.machineCondition, style: 'td' }
				]
			: []),

		{ text: 'Travaux réalisés', style: 'blockTitle', margin: [0, 16, 0, 4] },
		{
			text: o.workDescription?.trim() || 'À compléter.',
			style: o.workDescription ? 'td' : 'muted'
		},

		{ text: 'Pièces', style: 'blockTitle', margin: [0, 16, 0, 4] },
		parts,

		{
			columns: [{ text: '' }, { width: 'auto', table: { body: totals }, layout: 'msTotals' }],
			margin: [0, 12, 0, 0]
		},

		...(isWarranty
			? [
					{
						text: 'Prise en charge sous garantie : les montants sont indiqués pour le suivi, rien n’est dû par le client.',
						style: 'muted',
						margin: [0, 6, 0, 0]
					}
				]
			: []),

		...(o.notes
			? [
					{ text: 'Note', style: 'blockTitle', margin: [0, 16, 0, 4] },
					{ text: o.notes, style: 'td' }
				]
			: []),

		// ---- Signatures ----
		{
			columns: [
				{
					stack: [
						{ text: 'Accord du client à la prise en charge', style: 'blockTitle' },
						{ canvas: [{ type: 'rect', x: 0, y: 0, w: 230, h: 55, lineColor: PDF_COLORS.rule }] }
					]
				},
				{
					stack: [
						{ text: 'Machine restituée — signature du client', style: 'blockTitle' },
						{ canvas: [{ type: 'rect', x: 0, y: 0, w: 230, h: 55, lineColor: PDF_COLORS.rule }] }
					]
				}
			],
			columnGap: 24,
			margin: [0, 28, 0, 0],
			unbreakable: true
		}
	] as Content[];

	return {
		pageSize: 'A4',
		pageMargins: [40, 40, 40, 60],
		content: body,
		defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
		styles: {
			brand: { fontSize: 15, bold: true, color: BLUE, margin: [0, 0, 0, 3] },
			docTitle: { fontSize: 15, bold: true, color: INK },
			docNumber: { fontSize: 12, bold: true, color: BLUE, margin: [0, 2, 0, 2] },
			blockTitle: { fontSize: 10, bold: true, margin: [0, 0, 0, 4] },
			label: { fontSize: 8.5, color: MUTED },
			th: { fontSize: 8, bold: true, color: INK },
			td: { fontSize: 8.5 },
			muted: { fontSize: 8.5, color: MUTED },
			totalLabel: { fontSize: 9, alignment: 'right', color: MUTED },
			totalValue: { fontSize: 9, alignment: 'right' },
			grandLabel: { fontSize: 11, bold: true, alignment: 'right', color: BLUE },
			grandValue: { fontSize: 11, bold: true, alignment: 'right', color: BLUE }
		},
		footer: (page, pages) => ({
			text: `${COMPANY.legalName} · SIREN ${COMPANY.siren} · ${COMPANY.rcs} · ${o.reference} · page ${page}/${pages}`,
			alignment: 'center',
			fontSize: 7.5,
			color: MUTED,
			margin: [40, 20, 40, 0]
		}),
		info: { title: `Ordre de réparation ${o.reference}`, author: COMPANY.name }
	};
}

/** Rend l'ordre de réparation en PDF. */
export function renderRepairOrderPdf(order: RepairDocument): Promise<Buffer> {
	return renderPdf(buildDefinition(order));
}

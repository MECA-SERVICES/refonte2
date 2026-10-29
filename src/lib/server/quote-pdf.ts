import type { Content } from 'pdfmake/interfaces';
import type { getQuote } from './quotes';
import { documentDefinition } from './document-pdf';
import { pdfShortDate as shortDate, renderPdf } from './pdf';

/**
 * Devis en PDF (`document-pdf.ts`), sur la charte des factures (CDC 23, § 8) :
 * date limite de validité et cadre « Bon pour accord ». La note interne n'y
 * figure jamais (R13).
 */

type Doc = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

export function renderQuotePdf(doc: Doc): Promise<Buffer> {
	const { quote } = doc;
	const isDraft = quote.status === 'draft';
	const number = quote.number ?? `Brouillon n° ${quote.id}`;

	const after: Content[] = [];
	if (quote.note) after.push({ text: quote.note, style: 'muted', margin: [0, 12, 0, 0] });
	after.push({
		columns: [
			{ text: '' },
			{
				width: 230,
				table: {
					widths: ['*'],
					heights: [70],
					body: [
						[
							{
								text: 'Date, signature et mention « Bon pour accord »',
								style: 'muted'
							}
						]
					]
				},
				layout: 'msTable'
			}
		],
		margin: [0, 24, 0, 0],
		unbreakable: true
	});

	return renderPdf(
		documentDefinition({
			title: isDraft ? 'DEVIS (BROUILLON)' : 'DEVIS',
			number,
			date: quote.issuedOn ?? quote.createdAt,
			mentions: [
				quote.validUntil
					? `Valable jusqu’au ${shortDate(quote.validUntil)}`
					: `Valable ${quote.validityDays} jours`,
				...(doc.repair ? [`Ordre de réparation ${doc.repair.reference}`] : [])
			],
			billingAddress: quote.billingAddress,
			customer: doc.customer,
			lines: doc.lines,
			taxBreakdown: quote.taxBreakdown ?? [],
			totalHt: quote.totalHt,
			totalTva: quote.totalTva,
			totalTtc: quote.totalTtc,
			extraTotals: [],
			after,
			fileTitle: `Devis ${number}`
		})
	);
}

import type { Content } from 'pdfmake/interfaces';
import type { getCounterInvoice } from './counter-invoices';
import { documentDefinition } from './document-pdf';
import { pdfEuro as euro, pdfShortDate as shortDate, renderPdf } from './pdf';

/**
 * Facture comptoir ou avoir en PDF (`document-pdf.ts`), avec règlements et
 * reste à payer.
 */

type Doc = NonNullable<Awaited<ReturnType<typeof getCounterInvoice>>>;

const METHODS: Record<string, string> = {
	cash: 'Espèces',
	card: 'Carte bancaire',
	transfer: 'Virement'
};

export function renderCounterInvoicePdf(doc: Doc): Promise<Buffer> {
	const { invoice, settlements, paid, credited, remaining } = doc;
	const isCredit = invoice.kind === 'credit_note';
	const isDraft = invoice.status === 'draft';
	const number = invoice.number ?? `Brouillon n° ${invoice.id}`;

	const after: Content[] = [];
	if (settlements.length) {
		after.push({
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
									: (METHODS[s.method] ?? s.method),
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
	if (invoice.note) after.push({ text: invoice.note, style: 'muted', margin: [0, 12, 0, 0] });
	if (!isCredit) {
		after.push({
			text: 'Pénalités de retard : trois fois le taux d’intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €. Pas d’escompte pour paiement anticipé.',
			style: 'muted',
			margin: [0, 12, 0, 0]
		});
	}

	return renderPdf(
		documentDefinition({
			title: isDraft
				? isCredit
					? 'AVOIR (BROUILLON)'
					: 'BROUILLON'
				: isCredit
					? 'AVOIR'
					: 'FACTURE',
			number,
			date: invoice.issuedOn ?? invoice.createdAt,
			mentions: [
				...(doc.creditedInvoice?.number
					? [`Avoir sur la facture ${doc.creditedInvoice.number}`]
					: []),
				...(doc.repair ? [`Ordre de réparation ${doc.repair.reference}`] : [])
			],
			billingAddress: invoice.billingAddress,
			customer: doc.customer,
			lines: doc.lines,
			taxBreakdown: invoice.taxBreakdown ?? [],
			totalHt: invoice.totalHt,
			totalTva: invoice.totalTva,
			totalTtc: invoice.totalTtc,
			extraTotals:
				!isCredit && !isDraft
					? [
							['Déjà réglé', paid, false],
							...(credited ? [['Avoirs', credited, false] as [string, number, boolean]] : []),
							['Reste à payer', Math.max(0, remaining), true]
						]
					: [],
			after,
			fileTitle: `${isCredit ? 'Avoir' : 'Facture'} ${number}`
		})
	);
}

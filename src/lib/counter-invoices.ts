/**
 * Calculs des factures comptoir, comme Dolibarr : chaque ligne est arrondie
 * au centime (HT après remise, puis TVA), la facture est la somme de ses
 * lignes, et la TVA se ventile par taux. Fonctions pures, partagées par le
 * serveur, l'écran de saisie et leurs tests.
 */
import { round2 } from '$lib/money';

export type LineInput = {
	quantity: number;
	unitPriceHt: number;
	taxRate: number;
	discountPercent: number;
};

/**
 * Détail saisi sous la désignation d'une ligne (n° de série, garantie) :
 * retours à la ligne gardés, espaces de fin et lignes vides en trop retirés.
 */
export function lineDetail(value: string | null | undefined): string | null {
	const detail = (value ?? '')
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return detail || null;
}

/** Totaux d'une ligne : HT après remise, TVA et TTC, au centime. */
export function lineTotals(l: LineInput) {
	const totalHt = round2(l.quantity * l.unitPriceHt * (1 - l.discountPercent / 100));
	const totalTva = round2((totalHt * l.taxRate) / 100);
	return { totalHt, totalTva, totalTtc: round2(totalHt + totalTva) };
}

/** Totaux de la facture et détail des taxes par taux. */
export function invoiceTotals(lines: LineInput[]) {
	const byRate = new Map<number, { rate: number; baseHt: number; taxAmount: number }>();
	let totalHt = 0;
	let totalTva = 0;
	for (const l of lines) {
		const t = lineTotals(l);
		totalHt += t.totalHt;
		totalTva += t.totalTva;
		const row = byRate.get(l.taxRate) ?? { rate: l.taxRate, baseHt: 0, taxAmount: 0 };
		row.baseHt = round2(row.baseHt + t.totalHt);
		row.taxAmount = round2(row.taxAmount + t.totalTva);
		byRate.set(l.taxRate, row);
	}
	return {
		totalHt: round2(totalHt),
		totalTva: round2(totalTva),
		totalTtc: round2(totalHt + totalTva),
		taxBreakdown: [...byRate.values()].sort((a, b) => b.rate - a.rate)
	};
}

/** Prix HT à 4 décimales depuis un prix TTC saisi au comptoir. */
export function priceHtFromTtc(priceTtc: number, taxRate: number): number {
	return Math.round((priceTtc / (1 + taxRate / 100)) * 10_000) / 10_000;
}

/**
 * Numéro légal, au format de la série Dolibarr : préfixe, année et mois de
 * validation sur 4 chiffres, compteur continu sur 4 chiffres au moins
 * (`FA2611-1316`, `AV2611-0033`, devis `PR2611-0322`).
 */
export function formatCounterNumber(
	prefix: 'FA' | 'AV' | 'PR',
	date: Date,
	counter: number
): string {
	const yy = String(date.getFullYear() % 100).padStart(2, '0');
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	return `${prefix}${yy}${mm}-${String(counter).padStart(4, '0')}`;
}

/** Compteur d'un numéro de la série (`FA2610-1315` → 1315), ou null. */
export function counterOf(number: string): number | null {
	const m = /^(?:FA|AV|AC)\d{4}-(\d+)$/.exec(number.trim());
	return m ? Number(m[1]) : null;
}

export const COUNTER_STATUS = {
	draft: { label: 'Brouillon', color: 'gray' },
	validated: { label: 'Impayée', color: 'yellow' },
	paid: { label: 'Payée', color: 'green' },
	abandoned: { label: 'Abandonnée', color: 'red' }
} as const;

/** Reste à payer, au centime ; négatif si le client a trop versé. */
export function remainingDue(totalTtc: number, paid: number, credited: number): number {
	// `+ 0` : jamais de « −0 » à l'écran.
	return round2(totalTtc - paid - credited) + 0;
}

export const counterKinds = {
	invoice: 'Facture standard',
	credit_note: 'Avoir',
	deposit: 'Facture d’acompte'
} as const;

/** Conditions de règlement, celles de Dolibarr. */
export const paymentTerms = ['receipt', '14d', '30d', '30d_end_month'] as const;
export type PaymentTerms = (typeof paymentTerms)[number];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
	receipt: 'À réception',
	'14d': '14 jours',
	'30d': '30 jours',
	'30d_end_month': '30 jours fin de mois'
};

export function isPaymentTerms(value: unknown): value is PaymentTerms {
	return paymentTerms.includes(value as PaymentTerms);
}

/** Date limite de règlement (`AAAA-MM-JJ`) d'une facture datée du `issuedOn`. */
export function dueDate(issuedOn: string, terms: PaymentTerms): string {
	const d = new Date(`${issuedOn}T00:00:00Z`);
	if (terms === '14d') d.setUTCDate(d.getUTCDate() + 14);
	if (terms === '30d' || terms === '30d_end_month') d.setUTCDate(d.getUTCDate() + 30);
	if (terms === '30d_end_month') d.setUTCMonth(d.getUTCMonth() + 1, 0);
	return d.toISOString().slice(0, 10);
}

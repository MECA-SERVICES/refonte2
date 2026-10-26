/**
 * Vocabulaire partagé des règlements saisis en back-office.
 *
 * Un règlement est un encaissement au comptoir (chèque, espèces, carte,
 * virement), jamais proposé en boutique : le tunnel de commande a ses propres
 * moyens de paiement (`$lib/payment-methods`). Les chèques et les espèces
 * alimenteront les bordereaux de remise en banque.
 */
import { round2 } from '$lib/money';

export const settlementMethods = ['cheque', 'cash', 'card', 'transfer'] as const;
export type SettlementMethod = (typeof settlementMethods)[number];

export const SETTLEMENT_METHOD_LABELS: Record<SettlementMethod, string> = {
	cheque: 'Chèque',
	cash: 'Espèces',
	card: 'Carte bancaire',
	transfer: 'Virement'
};

export function isSettlementMethod(value: unknown): value is SettlementMethod {
	return settlementMethods.includes(value as SettlementMethod);
}

/** Reste à régler, au centime ; jamais négatif. */
export function remainingDue(total: string | number, paid: (string | number)[]): number {
	const sum = paid.reduce<number>((acc, amount) => acc + Number(amount), 0);
	return Math.max(0, round2(Number(total) - sum));
}

/**
 * Référence d'un règlement, à la manière de Dolibarr : `PAY2610-0042`.
 * Le compteur est l'identifiant en base, unique par construction ; l'année et
 * le mois sont ceux de la réception (`AAAA-MM-JJ`).
 */
export function buildSettlementReference(id: number, receivedOn: string): string {
	return `PAY${receivedOn.slice(2, 4)}${receivedOn.slice(5, 7)}-${String(id).padStart(4, '0')}`;
}

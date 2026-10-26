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

/** Bordereaux de remise : les chèques d'un côté, les espèces de l'autre. */
export const remittanceKinds = ['cheque', 'cash'] as const;
export type RemittanceKind = (typeof remittanceKinds)[number];

export const REMITTANCE_KIND_LABELS: Record<RemittanceKind, string> = {
	cheque: 'Chèques',
	cash: 'Espèces'
};

export function isRemittanceKind(value: unknown): value is RemittanceKind {
	return remittanceKinds.includes(value as RemittanceKind);
}

/** Compte crédité par défaut, nommé comme dans Dolibarr. */
export const DEFAULT_BANK_ACCOUNT = 'COMPTE-PRO';

/**
 * Référence d'un bordereau, à la manière de Dolibarr : `CHK2610-0001` pour
 * les chèques, `ESP2610-0001` pour les espèces. Mois du dépôt (`AAAA-MM-JJ`).
 */
export function buildRemittanceReference(
	kind: RemittanceKind,
	id: number,
	depositedOn: string
): string {
	const prefix = kind === 'cheque' ? 'CHK' : 'ESP';
	return `${prefix}${depositedOn.slice(2, 4)}${depositedOn.slice(5, 7)}-${String(id).padStart(4, '0')}`;
}

/**
 * Nom affiché du payeur d'un règlement : l'émetteur du chèque, sinon la
 * société du client, sinon le client.
 */
export function payerName(line: {
	chequeIssuer: string | null;
	customerCompany: string | null;
	customerFirstName: string | null;
	customerLastName: string | null;
}): string {
	return (
		line.chequeIssuer ||
		line.customerCompany ||
		[line.customerFirstName, line.customerLastName].filter(Boolean).join(' ') ||
		'—'
	);
}

/**
 * Libellés des bons de stock (réceptions, sorties), partagés par les pages.
 * L'adresse porte le type au pluriel : `/admin/stock/vouchers/receipts`.
 */
export const VOUCHER_KINDS = {
	receipts: {
		kind: 'receipt',
		title: 'Réceptions fournisseur',
		one: 'réception',
		create: 'Nouvelle réception',
		subtitle: 'Bons d’entrée : ce qui arrive des fournisseurs, rangé emplacement par emplacement'
	},
	issues: {
		kind: 'issue',
		title: 'Sorties de stock',
		one: 'sortie',
		create: 'Nouvelle sortie',
		subtitle:
			'Bons de sortie hors commande et hors réparation : normal, consommable, investissement'
	}
} as const;

export type VoucherKindSlug = keyof typeof VOUCHER_KINDS;

export function isVoucherKindSlug(value: string): value is VoucherKindSlug {
	return value in VOUCHER_KINDS;
}

/** Libellé d'un motif de sortie. */
export function reasonLabel(reason: string | null): string {
	return reason === 'consumable'
		? 'Consommable'
		: reason === 'investment'
			? 'Investissement'
			: 'Normal';
}

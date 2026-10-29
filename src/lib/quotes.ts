/**
 * Cycle des devis (CDC 23, § 4), en fonctions pures partagées par le serveur,
 * les écrans et leurs tests. Les calculs de lignes sont ceux des factures
 * comptoir (`$lib/counter-invoices`).
 */

/**
 * Statuts enregistrés :
 * - `draft` : en rédaction, jamais visible du client (R2) ;
 * - `sent` : numéroté et transmis, en attente de décision ;
 * - `accepted`, `rejected` : décision du client (R9) ;
 * - `invoiced` : accepté et transformé en facture comptoir (R10, R11).
 *
 * « Expiré » (R4) ne s'enregistre pas : c'est un devis envoyé dont la date
 * limite est passée (`quoteStatus`).
 */
export const quoteStatuses = ['draft', 'sent', 'accepted', 'rejected', 'invoiced'] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];
export type QuoteDisplayStatus = QuoteStatus | 'expired';

export const QUOTE_STATUS = {
	draft: { label: 'Brouillon', color: 'gray' },
	sent: { label: 'Envoyé', color: 'blue' },
	expired: { label: 'Expiré', color: 'yellow' },
	accepted: { label: 'Accepté', color: 'green' },
	rejected: { label: 'Refusé', color: 'red' },
	invoiced: { label: 'Facturé', color: 'indigo' }
} as const satisfies Record<QuoteDisplayStatus, { label: string; color: string }>;

/** Durée de validité par défaut, celle des devis Dolibarr. */
export const DEFAULT_VALIDITY_DAYS = 15;

/** Statut affiché : un devis envoyé dont la date limite est passée a expiré. */
export function quoteStatus(
	q: { status: QuoteStatus; validUntil: string | null },
	today: string
): QuoteDisplayStatus {
	return q.status === 'sent' && q.validUntil !== null && q.validUntil < today
		? 'expired'
		: q.status;
}

/** Date limite de validité (R3) : date d'émission + durée, au format `AAAA-MM-JJ`. */
export function validUntilOf(issuedOn: string, validityDays: number): string {
	const d = new Date(`${issuedOn}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + validityDays);
	return d.toISOString().slice(0, 10);
}

/**
 * Libellé du moyen de paiement d'une commande.
 *
 * `order.payment_provider` porte le code technique du module : ceux du
 * nouveau tunnel (`monetico`, `bank_transfer`) et ceux repris de PrestaShop
 * (`sdevmonetico`, `cmcicpaiement`, `ps_wirepayment`…). Partagé client/serveur.
 */
const LABELS: Record<string, string> = {
	monetico: 'Carte bancaire',
	sdevmonetico: 'Carte bancaire',
	cmcicpaiement: 'Carte bancaire',
	bank_transfer: 'Virement',
	ps_wirepayment: 'Virement',
	bankwire: 'Virement',
	paypal: 'PayPal',
	free_order: 'Commande gratuite'
};

export function paymentMethodLabel(provider: string | null | undefined): string {
	if (!provider) return '—';
	return LABELS[provider] ?? provider;
}

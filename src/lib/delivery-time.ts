/**
 * Messages de délai d'expédition affichés sur la fiche produit.
 *
 * Repris de l'onglet « Livraison » de PrestaShop : chaque produit annonce
 * quand il part, selon qu'il est en stock ou non.
 *
 * Partagé navigateur/serveur, sans accès base.
 *
 * ## Pourquoi des textes libres
 *
 * Un délai en jours ne saurait porter « Nous consulter » ni « Expédition 5 à
 * 10 jours* » avec son astérisque. L'atelier écrit ce qu'il veut annoncer, et
 * la boutique l'affiche tel quel.
 */

/** Régime de délai d'un produit. */
export const DELIVERY_TIME_MODES = ['none', 'default', 'specific'] as const;
export type DeliveryTimeMode = (typeof DELIVERY_TIME_MODES)[number];

export const DELIVERY_TIME_MODE_LABELS: Record<DeliveryTimeMode, string> = {
	none: 'Aucun délai affiché',
	default: 'Délai par défaut de la boutique',
	specific: 'Délai spécifique à ce produit'
};

/**
 * Messages par défaut de la boutique.
 *
 * En stock physique, le colis part de l'atelier ; sinon la pièce est
 * commandée chez le fabricant, d'où le délai plus long.
 *
 * À déplacer dans le paramétrage entreprise (CDC 41) quand il existera.
 */
export const DEFAULT_DELIVERY_TIME = {
	inStock: 'Expédition sous 24 à 48 h ouvrées',
	outOfStock: 'Expédition sous 5 à 10 jours ouvrés'
} as const;

/** Champs de délai portés par un produit. */
export type DeliveryTimeFields = {
	deliveryTimeMode?: string | null;
	deliveryTimeInStock?: string | null;
	deliveryTimeOutOfStock?: string | null;
};

/** Ramène une valeur inconnue au régime par défaut. */
export function normalizeDeliveryMode(value?: string | null): DeliveryTimeMode {
	const raw = (value ?? '').trim();
	return (DELIVERY_TIME_MODES as readonly string[]).includes(raw)
		? (raw as DeliveryTimeMode)
		: 'default';
}

/**
 * Message de délai à afficher pour un produit, ou `null` s'il ne faut rien
 * annoncer.
 *
 * `inStock` décide lequel des deux messages s'applique — c'est l'appelant qui
 * connaît l'état réel du stock, variantes comprises.
 *
 * Un message spécifique laissé vide **désactive** l'affichage, comme chez
 * PrestaShop : « Laisser vide pour désactiver ».
 */
export function resolveDeliveryTime(product: DeliveryTimeFields, inStock: boolean): string | null {
	const mode = normalizeDeliveryMode(product.deliveryTimeMode);
	if (mode === 'none') return null;

	if (mode === 'specific') {
		const own = inStock ? product.deliveryTimeInStock : product.deliveryTimeOutOfStock;
		return own?.trim() || null;
	}

	return inStock ? DEFAULT_DELIVERY_TIME.inStock : DEFAULT_DELIVERY_TIME.outOfStock;
}

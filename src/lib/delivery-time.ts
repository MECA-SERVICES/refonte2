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

/** Ajoute `days` jours ouvrés (hors samedi et dimanche) à une date. */
function addBusinessDays(from: Date, days: number): Date {
	const d = new Date(from);
	let left = days;
	while (left > 0) {
		d.setDate(d.getDate() + 1);
		const day = d.getDay();
		if (day !== 0 && day !== 6) left -= 1;
	}
	return d;
}

/**
 * Fenêtre d'expédition estimée à partir d'un message de délai (demande client
 * 9.4) : « sous 24 à 48 h », « 5 à 10 jours ouvrés », « sous 3 jours »…
 *
 * Les heures sont arrondies au jour ouvré supérieur (48 h = 2 jours). Les
 * jours fériés ne sont pas décomptés : c'est une estimation, affichée comme
 * telle. Un message sans durée lisible (« Nous consulter ») ne donne rien.
 */
export function estimateShippingWindow(
	message: string | null | undefined,
	from: Date = new Date()
): { earliest: Date; latest: Date } | null {
	if (!message) return null;
	const text = message.toLowerCase();
	const match = text.match(/(\d+)\s*(?:(?:à|a|-)\s*(\d+)\s*)?(h\b|heures?|jours?|j\b)/);
	if (!match) return null;

	const min = Number(match[1]);
	const max = Number(match[2] ?? match[1]);
	const toDays = (n: number) => (match[3].startsWith('h') ? Math.max(1, Math.ceil(n / 24)) : n);

	return {
		earliest: addBusinessDays(from, toDays(min)),
		latest: addBusinessDays(from, toDays(max))
	};
}

export type ShippingEstimate = {
	/** Message de délai retenu, tel qu'affiché sur la fiche produit. */
	message: string;
	earliest: Date | null;
	latest: Date | null;
};

/**
 * Délai d'expédition d'un panier ou d'une commande (demande client 12.2) :
 * le colis part quand tout est prêt, c'est donc le délai le plus long qui
 * compte. Sans délai lisible sur aucun article, celui de la boutique.
 */
export function cartShippingEstimate(
	lines: (DeliveryTimeFields & { stock: number })[],
	from: Date = new Date()
): ShippingEstimate {
	let best: ShippingEstimate | null = null;
	for (const line of lines) {
		const message = resolveDeliveryTime(line, line.stock > 0);
		const window = estimateShippingWindow(message, from);
		if (!message || !window) continue;
		if (!best?.latest || window.latest > best.latest) best = { message, ...window };
	}
	if (best) return best;
	const fallback = estimateShippingWindow(DEFAULT_DELIVERY_TIME.inStock, from);
	return {
		message: DEFAULT_DELIVERY_TIME.inStock,
		earliest: fallback?.earliest ?? null,
		latest: fallback?.latest ?? null
	};
}

const longDay = new Intl.DateTimeFormat('fr-FR', {
	weekday: 'long',
	day: 'numeric',
	month: 'long'
});

/** Date `AAAA-MM-JJ` lue à midi, à l'abri des fuseaux horaires. */
const asDate = (d: Date | string) => (typeof d === 'string' ? new Date(`${d}T12:00:00`) : d);

/**
 * Fenêtre d'expédition en toutes lettres : « le lundi 2 novembre », ou
 * « entre le lundi 2 novembre et le lundi 9 novembre ».
 */
export function describeShippingWindow(earliest: Date | string, latest: Date | string): string {
	const from = longDay.format(asDate(earliest));
	const to = longDay.format(asDate(latest));
	return from === to ? `le ${to}` : `entre le ${from} et le ${to}`;
}

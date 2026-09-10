/**
 * Règles de livraison de la boutique — CDC section 21.
 *
 * Sendcloud fournit les offres et leurs tarifs ; ce module applique par-dessus
 * les contraintes propres au catalogue : transporteur imposé, seuil de poids,
 * blocage des points relais, surcoût produit.
 *
 * Il reste utilisable sans Sendcloud grâce à la grille de repli (R19), ce qui
 * permet à un client de finaliser sa commande même si l'API est indisponible.
 */

import {
	fetchShippingOptions,
	isSendcloudConfigured,
	type ShippingAddress,
	type ShippingOption
} from './sendcloud';

/** Article du panier, réduit à ce qui influence le transport. */
export type ShippableLine = {
	quantity: number;
	weightKg: number | null;
	lengthCm: number | null;
	widthCm: number | null;
	heightCm: number | null;
	shippingExtraFee: number | null;
	/** Code Sendcloud imposé par l'article (R5). */
	forcedCarrierCode?: string | null;
	/** Au-delà de ce poids total, le transporteur de l'article s'impose (R6). */
	minWeightThresholdKg?: number | null;
};

/**
 * Au-delà de ce montant TTC, les points relais ne sont plus proposés (R4).
 * Paramétrable en back-office à terme ; la valeur du CDC sert de défaut.
 */
export const RELAY_POINT_MAX_TTC = 250;

/**
 * Grille de repli, par tranche de poids (R19).
 *
 * Elle n'a pas vocation à refléter les tarifs réels : elle permet de ne jamais
 * bloquer une commande. L'opérateur choisit le transporteur à l'expédition, la
 * commande étant signalée en back-office (R20).
 */
export const FALLBACK_GRID: { maxWeightKg: number; priceHt: number }[] = [
	{ maxWeightKg: 2, priceHt: 5.9 },
	{ maxWeightKg: 5, priceHt: 8.9 },
	{ maxWeightKg: 10, priceHt: 12.9 },
	{ maxWeightKg: 30, priceHt: 19.9 },
	{ maxWeightKg: Number.POSITIVE_INFINITY, priceHt: 39.9 }
];

/** Types de dernier kilomètre correspondant à un retrait en point tiers. */
const RELAY_LAST_MILES = new Set(['service_point', 'locker', 'locker_or_service_point']);

/**
 * Écarte les offres qui n'ont pas de sens pour la destination.
 *
 * Sendcloud retourne tout le catalogue du compte : pour une livraison en France,
 * dix-neuf offres remontaient, dont des tarifs internationaux et des variantes
 * « QR » qui ne changent rien pour le client. Le tri se fait ici plutôt qu'à
 * l'affichage, pour que la commande ne puisse pas retenir une offre inapplicable.
 */
function isRelevant(option: ShippingOption, destinationCountry: string): boolean {
	// L'option de test ne doit jamais apparaître dans un tunnel client.
	if (option.code === 'sendcloud:letter') return false;

	const domestic = destinationCountry.toUpperCase() === 'FR';
	if (domestic && option.serviceArea === 'international') return false;
	if (!domestic && option.serviceArea?.startsWith('domestic')) return false;

	return true;
}

/**
 * Ne conserve qu'une offre par transporteur et par mode, la moins chère.
 *
 * « Point Relais » et « Point Relais QR » désignent le même service : le second
 * n'est qu'une modalité d'impression, invisible du client au moment du choix.
 */
function dedupe(options: ShippingOption[]): ShippingOption[] {
	const best = new Map<string, ShippingOption>();

	for (const option of options) {
		const key = `${option.carrierCode}:${option.mode}`;
		const kept = best.get(key);
		if (!kept) {
			best.set(key, option);
			continue;
		}
		// À tarif inconnu des deux côtés, le premier reçu fait foi : l'ordre de
		// Sendcloud place les offres principales avant leurs variantes.
		const challengerPrice = option.priceHt ?? Number.POSITIVE_INFINITY;
		const keptPrice = kept.priceHt ?? Number.POSITIVE_INFINITY;
		if (challengerPrice < keptPrice) best.set(key, option);
	}

	return [...best.values()];
}

/**
 * Poids retenu pour un article dont la fiche n'en porte aucun.
 *
 * Près de 70 % du catalogue est dans ce cas, héritage de la reprise
 * PrestaShop. Or Sendcloud refuse un poids nul (« Input should be greater than
 * 0 ») : sans plancher, toutes ces commandes basculeraient en grille de repli.
 * 100 g correspond à une petite pièce détachée ; l'opérateur saisit de toute
 * façon le poids réel à l'expédition (R12).
 */
export const DEFAULT_LINE_WEIGHT_KG = 0.1;

/**
 * Poids total du panier, arrondi au centième (R1).
 *
 * Un article sans poids compte pour `DEFAULT_LINE_WEIGHT_KG` : mieux vaut une
 * estimation basse qu'une requête rejetée.
 */
export function cartWeightKg(lines: ShippableLine[]): number {
	const total = lines.reduce(
		(sum, line) => sum + (line.weightKg || DEFAULT_LINE_WEIGHT_KG) * line.quantity,
		0
	);
	return Math.max(DEFAULT_LINE_WEIGHT_KG, Math.round(total * 100) / 100);
}

/**
 * Dimensions du colis : le maximum constaté sur les articles (R3).
 *
 * Approximation volontaire — empiler réellement des articles relève d'un
 * calcul d'emballage que Sendcloud ne demande pas.
 */
export function cartDimensionsCm(lines: ShippableLine[]) {
	const max = (pick: (l: ShippableLine) => number | null) =>
		lines.reduce((m, line) => Math.max(m, pick(line) ?? 0), 0);

	const length = max((l) => l.lengthCm);
	const width = max((l) => l.widthCm);
	const height = max((l) => l.heightCm);

	return length && width && height ? { length, width, height } : undefined;
}

/** Surcoût de transport propre aux articles, cumulé sur le panier (R9). */
export function extraShippingFee(lines: ShippableLine[]): number {
	const total = lines.reduce((sum, line) => sum + (line.shippingExtraFee ?? 0) * line.quantity, 0);
	return Math.round(total * 100) / 100;
}

/**
 * Transporteur imposé par le panier, s'il y en a un.
 *
 * R5 prime sur R6 : un transporteur imposé sur un article s'applique quel que
 * soit le poids. À défaut, un article dont le seuil de poids est atteint impose
 * le sien.
 */
export function forcedCarrierCode(lines: ShippableLine[], weightKg: number): string | null {
	// R5 — contrainte inconditionnelle : l'article impose son transporteur quel
	// que soit le poids. Un article portant aussi un seuil relève de R6, pas
	// d'ici : le confondre imposerait le transporteur dès le premier gramme.
	const always = lines.find((line) => line.forcedCarrierCode && line.minWeightThresholdKg == null);
	if (always?.forcedCarrierCode) return always.forcedCarrierCode;

	// R6 — le seuil de poids est atteint : le transporteur de l'article s'impose.
	const byWeight = lines.find(
		(line) =>
			line.forcedCarrierCode &&
			line.minWeightThresholdKg != null &&
			weightKg >= line.minWeightThresholdKg
	);
	return byWeight?.forcedCarrierCode ?? null;
}

/** Offres issues de la grille de repli, présentées comme telles. */
export function fallbackOptions(weightKg: number): ShippingOption[] {
	const tier =
		FALLBACK_GRID.find((row) => weightKg <= row.maxWeightKg) ??
		FALLBACK_GRID[FALLBACK_GRID.length - 1];

	return [
		{
			code: 'fallback:standard',
			name: 'Livraison standard',
			carrierCode: 'fallback',
			carrierName: 'À déterminer',
			carrierLogoUrl: null,
			lastMile: 'home_delivery',
			mode: 'home',
			serviceArea: 'domestic',
			requiresServicePoint: false,
			priceHt: tier.priceHt,
			currency: 'EUR',
			fallback: true
		}
	];
}

export type ShippingQuoteParams = {
	lines: ShippableLine[];
	from: ShippingAddress;
	to: ShippingAddress;
	/** Montant TTC du panier, qui conditionne l'accès aux points relais (R4). */
	cartTotalTtc: number;
};

export type ShippingQuote = {
	options: ShippingOption[];
	weightKg: number;
	extraFee: number;
	/** Renseigné lorsqu'une contrainte réduit le choix, à expliquer au client (R7). */
	restriction: string | null;
	/** Vrai si la grille de repli a été employée : la commande sera signalée (R20). */
	usedFallback: boolean;
};

/**
 * Offres applicables au panier, contraintes métier comprises.
 *
 * Les tarifs incluent le surcoût produit et sont triés par prix croissant (R8).
 * Une offre sans tarif — contrat transporteur non activé — reste proposée en
 * fin de liste plutôt que masquée : la commande peut être passée, le tarif
 * étant arbitré à l'expédition.
 */
export async function quoteShipping(params: ShippingQuoteParams): Promise<ShippingQuote> {
	const weightKg = cartWeightKg(params.lines);
	const extraFee = extraShippingFee(params.lines);
	const forced = forcedCarrierCode(params.lines, weightKg);

	let options: ShippingOption[];
	let usedFallback = false;

	if (!isSendcloudConfigured()) {
		options = fallbackOptions(weightKg);
		usedFallback = true;
	} else {
		try {
			const fetched = await fetchShippingOptions({
				from: params.from,
				to: params.to,
				weightKg,
				dimensionsCm: cartDimensionsCm(params.lines)
			});
			options = dedupe(fetched.filter((o) => isRelevant(o, params.to.countryCode)));

			// Un filtrage trop strict ne doit pas priver le client de tout choix.
			if (options.length === 0) options = dedupe(fetched);
		} catch {
			// L'échec est déjà journalisé par le client (R21) : ici, on garantit
			// seulement que le client puisse terminer sa commande.
			options = fallbackOptions(weightKg);
			usedFallback = true;
		}
	}

	let restriction: string | null = null;

	if (!usedFallback) {
		if (forced) {
			const kept = options.filter((option) => option.carrierCode === forced);
			if (kept.length > 0) {
				options = kept;
				restriction = `Un article de votre panier impose une expédition ${kept[0].carrierName}.`;
			}
		}

		if (params.cartTotalTtc > RELAY_POINT_MAX_TTC) {
			const before = options.length;
			options = options.filter((option) => !RELAY_LAST_MILES.has(option.lastMile ?? ''));
			if (options.length < before) {
				restriction ??= `Au-delà de ${RELAY_POINT_MAX_TTC} € TTC, la livraison en point relais n'est pas proposée.`;
			}
		}
	}

	// Le surcoût produit s'ajoute au tarif de l'offre (R9).
	const priced = options.map((option) => ({
		...option,
		priceHt: option.priceHt === null ? null : Math.round((option.priceHt + extraFee) * 100) / 100
	}));

	// Tri par prix croissant (R8) ; les offres sans tarif ferment la marche.
	priced.sort((a, b) => {
		if (a.priceHt === null) return 1;
		if (b.priceHt === null) return -1;
		return a.priceHt - b.priceHt;
	});

	return { options: priced, weightKg, extraFee, restriction, usedFallback };
}

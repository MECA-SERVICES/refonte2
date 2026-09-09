/**
 * Régime de TVA et affichage des prix — CDC section 23.
 *
 * Deux notions distinctes cohabitent, et les confondre est l'erreur classique :
 *
 * - le **régime fiscal** décide du taux appliqué (R1-R3) ;
 * - le **mode d'affichage** décide si l'on montre le HT ou le TTC (P2-P3).
 *
 * Un professionnel français voit ses prix en HT tout en étant assujetti à 20 %.
 *
 * Ce module est partagé client/serveur : il ne fait aucun accès base.
 */

/** Types de compte reconnus (CDC section 08). */
export type CustomerType = 'particulier' | 'pro' | 'collectivite';

/** Statut fiscal, porté par `customer.tax_exempt_status`. */
export type TaxExemptStatus = 'standard' | 'exempt_eu_b2b';

/** Régimes de TVA, exhaustifs et mutuellement exclusifs (R1-R3). */
export type TaxRegime = 'export_outside_eu' | 'reverse_charge_eu' | 'standard';

/**
 * Éléments du client déterminant son régime.
 *
 * `null` couvre le visiteur non identifié, traité comme un particulier français.
 */
export type TaxProfile = {
	/** Pays de **facturation** (R4), codifié sur deux lettres (R5). */
	country?: string | null;
	type?: CustomerType | string | null;
	taxExemptStatus?: TaxExemptStatus | string | null;
	/** Un compte professionnel non validé relève du régime standard (R11). */
	status?: string | null;
} | null;

/**
 * États membres de l'Union européenne, hors France.
 *
 * La France est absente volontairement : un client français relève toujours de
 * R3, jamais de l'autoliquidation.
 */
const EU_COUNTRIES = new Set([
	'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'GR', 'HR', 'HU',
	'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
]);

/** Mentions légales portées sur les documents émis en exonération (R17). */
export const TAX_MENTIONS: Record<TaxRegime, string | null> = {
	export_outside_eu: 'Exonéré — Export hors UE, art. 262 ter du CGI',
	reverse_charge_eu: 'Autoliquidation de la TVA — art. 283-2 du CGI',
	standard: null
};

/** Un pays non renseigné équivaut à la France (R5). */
function normalizeCountry(country?: string | null): string {
	const code = (country ?? '').trim().toUpperCase();
	return code.length === 2 ? code : 'FR';
}

/** Les professionnels et collectivités partagent le même traitement fiscal. */
export function isBusinessType(type?: CustomerType | string | null): boolean {
	return type === 'pro' || type === 'collectivite';
}

/**
 * Détermine le régime applicable.
 *
 * Les trois cas sont évalués dans l'ordre du CDC : l'exonération n'est jamais le
 * comportement par défaut, tout cas non couvert retombe sur R3.
 */
export function resolveTaxRegime(profile: TaxProfile): TaxRegime {
	const country = normalizeCountry(profile?.country);

	// R1 — hors Union européenne : exonération à l'export.
	if (country !== 'FR' && !EU_COUNTRIES.has(country)) return 'export_outside_eu';

	// R2/R6 — autoliquidation : trois conditions cumulatives. Le statut
	// `exempt_eu_b2b` n'est posé que par un administrateur (R8), jamais déduit
	// d'un numéro de TVA seul.
	if (
		EU_COUNTRIES.has(country) &&
		isBusinessType(profile?.type) &&
		profile?.taxExemptStatus === 'exempt_eu_b2b' &&
		// R11 — un compte professionnel en attente reste au régime standard.
		profile?.status !== 'pending'
	) {
		return 'reverse_charge_eu';
	}

	// R3 — tous les autres cas, dont le particulier européen et le
	// professionnel dont le numéro n'a pas été vérifié.
	return 'standard';
}

/**
 * Taux effectivement appliqué à une ligne, en pourcentage.
 *
 * Le taux vient toujours de la règle de TVA du produit (R10) ; les régimes
 * exonérés le ramènent à zéro. Un produit sans règle est exonéré.
 */
export function effectiveTaxRate(
	productRate: string | number | null | undefined,
	regime: TaxRegime
): number {
	if (regime !== 'standard') return 0;
	const rate = Number(productRate ?? 0);
	return Number.isFinite(rate) ? rate : 0;
}

/** Ventilation d'un montant, telle qu'exigée au panier et sur les documents (R16). */
export type TaxBreakdown = {
	totalHt: number;
	totalTva: number;
	totalTtc: number;
};

/** Arrondi au centime — les montants monétaires ne portent que deux décimales. */
function round2(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcule la ventilation d'un montant hors taxes.
 *
 * La remise est soustraite **avant** le calcul de la TVA (R12), et les frais de
 * port suivent le même régime que les articles (R13) : il suffit de les inclure
 * dans le montant HT transmis.
 */
export function computeTax(totalHt: number, rate: number): TaxBreakdown {
	const ht = round2(totalHt);
	const tva = round2(ht * (rate / 100));
	return { totalHt: ht, totalTva: tva, totalTtc: round2(ht + tva) };
}

/**
 * Mode d'affichage des prix au catalogue (P2, P3).
 *
 * Indépendant du régime fiscal : il ne dépend que du type de compte connecté.
 */
export function priceDisplayMode(type?: CustomerType | string | null): 'ht' | 'ttc' {
	return isBusinessType(type) ? 'ht' : 'ttc';
}

/** Suffixe à accoler à tout montant affiché — aucun montant nu (P4, P5). */
export function priceSuffix(mode: 'ht' | 'ttc'): string {
	return mode === 'ht' ? 'HT' : 'TTC';
}

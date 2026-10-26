/**
 * Périodes des statistiques du tableau de bord (demande client 13.1).
 *
 * Une période se choisit librement (raccourci ou dates), et se compare à une
 * autre : la précédente de même durée, la même l'an passé, ou des dates
 * saisies. Les bornes sont des jours `AAAA-MM-JJ`, inclus tous les deux.
 *
 * Partagé navigateur et serveur, sans accès base.
 */

export type DayRange = { from: string; to: string };

export const STATS_PRESETS = {
	'7j': '7 derniers jours',
	'30j': '30 derniers jours',
	'90j': '90 derniers jours',
	'12m': '12 derniers mois',
	mois: 'Ce mois-ci',
	'mois-precedent': 'Mois précédent',
	annee: 'Cette année',
	perso: 'Dates personnalisées'
} as const;
export type StatsPreset = keyof typeof STATS_PRESETS;

export const STATS_COMPARISONS = {
	precedente: 'Période précédente',
	'annee-precedente': 'Même période l’an dernier',
	perso: 'Dates personnalisées'
} as const;
export type StatsComparison = keyof typeof STATS_COMPARISONS;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Jour `AAAA-MM-JJ` d'une date, selon le calendrier local. */
export function isoDay(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Date locale à midi : à l'abri des changements d'heure. */
function parseDay(day: string): Date {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(y, m - 1, d, 12);
}

function addDays(day: string, n: number): string {
	const d = parseDay(day);
	d.setDate(d.getDate() + n);
	return isoDay(d);
}

/** Nombre de jours d'une période, bornes comprises. */
export function rangeLength(range: DayRange): number {
	return (
		Math.round((parseDay(range.to).getTime() - parseDay(range.from).getTime()) / 86_400_000) + 1
	);
}

/** Période correspondant à un raccourci, à la date du jour. */
export function presetRange(preset: Exclude<StatsPreset, 'perso'>, today: Date): DayRange {
	const to = isoDay(today);
	const y = today.getFullYear();
	const m = today.getMonth();
	switch (preset) {
		case '7j':
			return { from: addDays(to, -6), to };
		case '30j':
			return { from: addDays(to, -29), to };
		case '90j':
			return { from: addDays(to, -89), to };
		case '12m':
			return { from: addDays(to, -364), to };
		case 'mois':
			return { from: isoDay(new Date(y, m, 1, 12)), to };
		case 'mois-precedent':
			return {
				from: isoDay(new Date(y, m - 1, 1, 12)),
				to: isoDay(new Date(y, m, 0, 12))
			};
		case 'annee':
			return { from: `${y}-01-01`, to };
	}
}

/** Période de même durée, juste avant. */
export function previousRange(range: DayRange): DayRange {
	const length = rangeLength(range);
	return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/** Mêmes dates, un an plus tôt (le 29 février devient le 28). */
export function lastYearRange(range: DayRange): DayRange {
	const shift = (day: string) => {
		const d = parseDay(day);
		const target = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate(), 12);
		// Le 29 février n'existe pas l'année précédente : on retient le 28.
		if (target.getMonth() !== d.getMonth()) target.setDate(0);
		return isoDay(target);
	};
	return { from: shift(range.from), to: shift(range.to) };
}

/** Une période saisie, bornes remises dans l'ordre ; `null` si illisible. */
function customRange(from: string | null, to: string | null): DayRange | null {
	if (!from || !to || !ISO.test(from) || !ISO.test(to)) return null;
	return from <= to ? { from, to } : { from: to, to: from };
}

/** Au-delà, une agrégation jour par jour n'apporte plus rien et coûte cher. */
const MAX_DAYS = 3 * 366;

export type StatsSelection = {
	preset: StatsPreset;
	comparison: StatsComparison;
	range: DayRange;
	compare: DayRange;
};

/**
 * Lit la période demandée dans l'URL : `periode`, `du`, `au`, `comparer`,
 * `cdu`, `cau`. Toute valeur absente ou illisible retombe sur les 30 derniers
 * jours comparés à la période précédente.
 */
export function parseStatsSelection(params: URLSearchParams, today: Date): StatsSelection {
	const rawPreset = params.get('periode');
	let preset: StatsPreset =
		rawPreset && rawPreset in STATS_PRESETS ? (rawPreset as StatsPreset) : '30j';

	let range: DayRange | null =
		preset === 'perso'
			? customRange(params.get('du'), params.get('au'))
			: presetRange(preset, today);
	if (!range || rangeLength(range) > MAX_DAYS) {
		preset = '30j';
		range = presetRange('30j', today);
	}

	const rawComparison = params.get('comparer');
	let comparison: StatsComparison =
		rawComparison && rawComparison in STATS_COMPARISONS
			? (rawComparison as StatsComparison)
			: 'precedente';

	let compare: DayRange | null =
		comparison === 'perso'
			? customRange(params.get('cdu'), params.get('cau'))
			: comparison === 'annee-precedente'
				? lastYearRange(range)
				: previousRange(range);
	if (!compare || rangeLength(compare) > MAX_DAYS) {
		comparison = 'precedente';
		compare = previousRange(range);
	}

	return { preset, comparison, range, compare };
}

/**
 * Congés de l'équipe, comme le module Congés de Dolibarr : types, états,
 * décompte en jours ouvrés (ni samedi, ni dimanche, ni jour férié), demi-
 * journées, et acquisition mensuelle des soldes. Fonctions pures, partagées
 * par le serveur, les écrans et leurs tests.
 */

export const leaveTypes = ['paid', 'rtt', 'sick', 'other'] as const;
export type LeaveType = (typeof leaveTypes)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
	paid: 'Congés payés',
	rtt: 'RTT',
	sick: 'Maladie',
	other: 'Autre absence'
};

/** Jours acquis par mois (Dolibarr : 2,08334 pour les congés payés, 0,83 pour les RTT). */
export const MONTHLY_ACCRUAL: Partial<Record<LeaveType, number>> = { paid: 2.08334, rtt: 0.83 };

/** Types décomptés d'un solde : les autres sont seulement enregistrés. */
export const balanceTypes = ['paid', 'rtt'] as const satisfies readonly LeaveType[];
export type BalanceType = (typeof balanceTypes)[number];

export const hasBalance = (type: LeaveType): type is BalanceType =>
	(balanceTypes as readonly string[]).includes(type);

export const leaveStatuses = ['pending', 'approved', 'refused', 'cancelled'] as const;
export type LeaveStatus = (typeof leaveStatuses)[number];

export const LEAVE_STATUS = {
	pending: { label: 'À approuver', color: 'yellow' },
	approved: { label: 'Approuvé', color: 'green' },
	refused: { label: 'Refusé', color: 'red' },
	cancelled: { label: 'Annulé', color: 'gray' }
} as const satisfies Record<LeaveStatus, { label: string; color: string }>;

export function isLeaveStatus(value: unknown): value is LeaveStatus {
	return leaveStatuses.includes(value as LeaveStatus);
}

export function isLeaveType(value: unknown): value is LeaveType {
	return leaveTypes.includes(value as LeaveType);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (day: string) => new Date(`${day}T00:00:00Z`);

/** Dimanche de Pâques (algorithme de Meeus), à minuit UTC. */
function easter(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(Date.UTC(year, month - 1, day));
}

/** Jours fériés de France métropolitaine d'une année (`AAAA-MM-JJ`). */
export function publicHolidays(year: number): Set<string> {
	const fixed = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'];
	const e = easter(year);
	const shift = (days: number) => iso(new Date(e.getTime() + days * 86_400_000));
	return new Set([...fixed.map((md) => `${year}-${md}`), shift(1), shift(39), shift(50)]);
}

export const isWorkingDay = (day: string) => {
	const d = utc(day);
	const weekday = d.getUTCDay();
	return weekday !== 0 && weekday !== 6 && !publicHolidays(d.getUTCFullYear()).has(day);
};

/**
 * Jours ouvrés d'une absence, du `start` au `end` inclus. `startsAfternoon` :
 * le premier jour ne compte que l'après-midi ; `endsAtNoon` : le dernier, que
 * le matin. Une absence d'une demi-journée vaut 0,5.
 */
export function leaveDays(
	start: string,
	end: string,
	startsAfternoon = false,
	endsAtNoon = false
): number {
	if (end < start) return 0;
	let days = 0;
	for (let d = utc(start); iso(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
		if (isWorkingDay(iso(d))) days++;
	}
	if (startsAfternoon && isWorkingDay(start)) days -= 0.5;
	if (endsAtNoon && isWorkingDay(end) && !(start === end && startsAfternoon)) days -= 0.5;
	return Math.max(0, days);
}

/** Mois entiers (`AAAA-MM`) acquis après `from`, jusqu'au mois de `today` inclus. */
export function monthsToAccrue(from: string, today: string): number {
	const [fy, fm] = from.split('-').map(Number);
	const [ty, tm] = today.split('-').map(Number);
	return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

/** Référence d'une demande, dans la série Dolibarr : `HL2610-0170`. */
export function leaveReference(date: Date, counter: number): string {
	const yy = String(date.getFullYear() % 100).padStart(2, '0');
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	return `HL${yy}${mm}-${String(counter).padStart(4, '0')}`;
}

/** Nombre de jours lisible : « 1 jour », « 2,5 jours ». */
export function formatDays(days: number): string {
	const n = Math.round(days * 100) / 100;
	return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} jour${Math.abs(n) > 1 ? 's' : ''}`;
}

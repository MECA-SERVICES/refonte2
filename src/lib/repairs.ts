/**
 * Vocabulaire partagé des ordres de réparation (CDC 31).
 *
 * États, prises en charge, libellés d'affichage et machine à états : tout ce
 * qui est lu aussi bien par le navigateur que par le serveur. Le module
 * `$lib/server/repairs` garde les accès à la base ; il réexporte ce qui suit
 * pour que le code serveur n'ait qu'un seul point d'entrée.
 */

/** États d'un ordre (CDC 31, §5). */
export const repairStatuses = [
	'to_do',
	'in_progress',
	'on_hold',
	'completed',
	'delivered',
	'cancelled'
] as const;
export type RepairStatus = (typeof repairStatuses)[number];

/** Prise en charge : payante ou sous garantie. */
export const repairOrderTypes = ['paid', 'warranty'] as const;
export type RepairOrderType = (typeof repairOrderTypes)[number];

/** Moment de la prise de vue (R22). */
export const repairImageMoments = ['before', 'after'] as const;
export type RepairImageMoment = (typeof repairImageMoments)[number];

// ===========================================================================
// Libellés
// ===========================================================================

/** Intitulés d'état, repris du cycle de vie du CDC (§5). */
export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
	to_do: 'À démarrer',
	in_progress: 'En cours',
	on_hold: 'En attente d’une pièce',
	completed: 'Travaux achevés',
	delivered: 'Machine restituée',
	cancelled: 'Annulé'
};

/** Couleur du badge d'état, dans la palette du back-office. */
export const REPAIR_STATUS_COLORS = {
	to_do: 'gray',
	in_progress: 'blue',
	on_hold: 'yellow',
	completed: 'green',
	delivered: 'green',
	cancelled: 'red'
} as const satisfies Record<RepairStatus, string>;

export const REPAIR_TYPE_LABELS: Record<RepairOrderType, string> = {
	paid: 'Payante',
	warranty: 'Sous garantie'
};

// ===========================================================================
// Cycle de vie
// ===========================================================================

/**
 * Transitions autorisées (CDC 31, §5).
 *
 * Deux absences sont volontaires et structurantes : on ne peut plus annuler
 * après l'achèvement — une correction impose un nouvel ordre (R20) — et un
 * ordre suspendu repasse obligatoirement par « en cours » avant d'être achevé.
 */
const ALLOWED_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
	to_do: ['in_progress', 'cancelled'],
	in_progress: ['on_hold', 'completed', 'cancelled'],
	on_hold: ['in_progress', 'cancelled'],
	completed: ['delivered'],
	delivered: [],
	cancelled: []
};

export function canTransition(from: RepairStatus, to: RepairStatus): boolean {
	return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** États à partir desquels l'ordre n'est plus modifiable (R17). */
export function isFrozen(status: RepairStatus): boolean {
	return status === 'completed' || status === 'delivered' || status === 'cancelled';
}

/** Prochains états proposables depuis l'état courant. */
export function nextStatuses(status: RepairStatus): RepairStatus[] {
	return ALLOWED_TRANSITIONS[status] ?? [];
}

/** Taille de page de la file des travaux. */
export const REPAIRS_PER_PAGE = 25;

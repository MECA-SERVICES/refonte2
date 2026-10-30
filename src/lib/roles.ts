/**
 * Rôles des comptes (CDC 34, § 4) : une hiérarchie cumulative, chaque niveau
 * ayant les droits des niveaux inférieurs.
 *
 * - `customer` (1) : espace client uniquement ; c'est le rôle des inscrits ;
 * - `employee` (2) : back-office opérationnel (commandes, devis, factures
 *   comptoir, catalogue, stock, clients, SAV, remises en banque) ;
 * - `admin` (4) : tout, y compris le paramétrage, l'équipe et les statistiques.
 *
 * Fonctions pures : la garde serveur (`hooks.server.ts`, `guard.ts`) et le menu
 * du back-office lisent les mêmes règles.
 */

export const roles = ['customer', 'employee', 'admin'] as const;
export type Role = (typeof roles)[number];

const LEVEL: Record<Role, number> = { customer: 1, employee: 2, admin: 4 };

export const ROLE_LABELS: Record<Role, string> = {
	customer: 'Client',
	employee: 'Employé',
	admin: 'Administrateur'
};

/** Rôles internes, attribuables depuis la page Équipe (R3). */
export const staffRoles = ['employee', 'admin'] as const satisfies readonly Role[];
export type StaffRole = (typeof staffRoles)[number];

export function isStaffRole(role: unknown): role is StaffRole {
	return staffRoles.includes(role as StaffRole);
}

/** Niveau d'un rôle ; un rôle absent ou inconnu est celui d'un client. */
export function roleLevel(role: string | null | undefined): number {
	return LEVEL[role as Role] ?? LEVEL.customer;
}

/** Accès au back-office : employé ou plus. */
export function hasBackOffice(role: string | null | undefined): boolean {
	return roleLevel(role) >= LEVEL.employee;
}

/**
 * Sections réservées aux administrateurs : paramétrage, comptes de l'équipe,
 * statistiques, apparence de la boutique.
 */
export const ADMIN_ONLY_PATHS = [
	'/admin/team',
	'/admin/stats',
	'/admin/order-states',
	'/admin/stock-locations/manage',
	'/admin/taxes',
	'/admin/homepage',
	'/admin/blog',
	'/admin/cms-pages',
	'/admin/popups'
];

/** Le rôle ouvre-t-il cette page du back-office (ou l'une de ses sous-pages) ? */
export function canAccess(role: string | null | undefined, pathname: string): boolean {
	if (!hasBackOffice(role)) return false;
	const adminOnly = ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
	return !adminOnly || roleLevel(role) >= LEVEL.admin;
}

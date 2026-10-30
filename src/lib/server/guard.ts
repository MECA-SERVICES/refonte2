import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { canAccess, hasBackOffice } from '$lib/roles';

/** Le compte accède-t-il au back-office (employé ou administrateur) ? */
export function isStaff(user: App.Locals['user']): boolean {
	return !!user && hasBackOffice(user.role);
}

/**
 * Garde du back-office : redirige les visiteurs non connectés vers le login,
 * et bloque (403) un compte sans accès au back-office ou sans le niveau
 * qu'exige la page (`canAccess` : paramétrage et équipe réservés aux
 * administrateurs). Retourne l'utilisateur, garanti non nul.
 */
export function requireStaff(event: RequestEvent) {
	const { user } = event.locals;

	if (!user) {
		const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(302, `/admin/login?redirectTo=${redirectTo}`);
	}

	if (!hasBackOffice(user.role)) {
		throw error(403, "Accès réservé à l'équipe.");
	}
	if (!canAccess(user.role, event.url.pathname)) {
		throw error(403, 'Accès réservé aux administrateurs.');
	}

	return user;
}

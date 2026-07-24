import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/** Rôles autorisés à accéder au back-office. */
const ADMIN_ROLES = ['admin'];

export function isAdmin(user: App.Locals['user']): boolean {
	return !!user && ADMIN_ROLES.includes(user.role ?? '');
}

/**
 * Garde du back-office : redirige les visiteurs non connectés vers le login
 * et bloque (403) les utilisateurs sans rôle admin.
 * Retourne l'utilisateur admin garanti non-nul pour un usage aval.
 */
export function requireAdmin(event: RequestEvent) {
	const { user } = event.locals;

	if (!user) {
		const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(302, `/admin/login?redirectTo=${redirectTo}`);
	}

	if (!isAdmin(user)) {
		throw error(403, "Accès réservé à l'administration.");
	}

	return user;
}

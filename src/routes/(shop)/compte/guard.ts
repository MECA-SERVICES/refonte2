import { redirect } from '@sveltejs/kit';
import { customerForUser } from '$lib/server/account';

/**
 * Fiche client de la session, ou redirection.
 *
 * Toutes les pages de l'espace client passent par elle : l'identifiant du client
 * est ainsi toujours résolu depuis la session, jamais depuis l'URL ou un
 * formulaire (CDC 09, R1).
 */
export async function requireCustomer(locals: App.Locals, pathname: string) {
	if (!locals.user) redirect(303, `/connexion?redirectTo=${encodeURIComponent(pathname)}`);

	const profile = await customerForUser(locals.user.id);
	// Compte authentifié sans fiche commerciale : le tableau de bord invite à la
	// compléter, inutile d'aller plus loin.
	if (!profile) redirect(303, '/compte');

	return profile;
}

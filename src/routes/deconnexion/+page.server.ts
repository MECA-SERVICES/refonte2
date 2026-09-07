import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { CART_COOKIE } from '$lib/server/cart';

/**
 * Déconnexion.
 *
 * Traitée côté serveur pour que la session soit révoquée même sans JavaScript,
 * et pour pouvoir nettoyer le cookie de panier visiteur dans la même réponse.
 */

/** N'accepte qu'une destination interne, afin d'éviter une redirection ouverte. */
function safeRedirect(target: string | null | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//')) return '/';
	return target;
}

// Une visite directe de l'URL ne déconnecte pas : seule une soumission le fait.
export const load: PageServerLoad = () => {
	redirect(303, '/');
};

export const actions: Actions = {
	default: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });

		// Le panier du compte reste en base ; seul le jeton visiteur éventuel est
		// effacé, pour ne pas rattacher l'ancien panier au visiteur suivant.
		event.cookies.delete(CART_COOKIE, { path: '/' });

		const form = await event.request.formData();
		redirect(303, safeRedirect(form.get('redirectTo')?.toString()));
	}
};

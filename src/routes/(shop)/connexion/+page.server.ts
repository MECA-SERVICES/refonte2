import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';

/** N'accepte qu'une destination interne, afin d'éviter une redirection ouverte. */
function safeRedirect(target: string | null | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//')) return '/compte';
	return target;
}

export const load: PageServerLoad = ({ locals, url }) => {
	// Déjà connecté : inutile de proposer le formulaire.
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	return { redirectTo: url.searchParams.get('redirectTo') ?? '' };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const email = form.get('email')?.toString().trim().toLowerCase() ?? '';
		const password = form.get('password')?.toString() ?? '';
		const redirectTo = safeRedirect(form.get('redirectTo')?.toString());

		if (!email || !password) {
			return fail(400, { email, message: 'Email et mot de passe requis.' });
		}

		try {
			await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				// Message générique : ne jamais révéler lequel des deux champs est
				// erroné, ni si l'email existe (règle R6 de la section 07).
				const banned = error.body?.code === 'BANNED_USER';
				return fail(401, {
					email,
					message: banned
						? 'Ce compte est suspendu. Contactez-nous pour en connaître le motif.'
						: 'Email ou mot de passe incorrect.'
				});
			}
			throw error;
		}

		redirect(303, redirectTo);
	}
};

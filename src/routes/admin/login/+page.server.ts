import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { isAdmin } from '$lib/server/guard';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) => {
	// Déjà connecté en admin → aller directement au back-office.
	if (isAdmin(event.locals.user)) {
		throw redirect(302, safeRedirect(event.url.searchParams.get('redirectTo')));
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const redirectTo = safeRedirect(formData.get('redirectTo')?.toString());

		if (!email || !password) {
			return fail(400, { email, message: 'Email et mot de passe requis.' });
		}

		// Le rôle admin est requis pour le back-office. On le vérifie en base :
		// getSession ne verrait pas encore la session créée dans cette même requête.
		const [account] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.email, email))
			.limit(1);
		if (account?.role !== 'admin') {
			return fail(403, { email, message: "Ce compte n'a pas accès à l'administration." });
		}

		try {
			// signInEmail valide les identifiants ET pose les cookies de session
			// (via le plugin sveltekitCookies). Une erreur = identifiants invalides.
			await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { email, message: error.message || 'Identifiants invalides.' });
			}
			return fail(500, { email, message: 'Erreur inattendue.' });
		}

		throw redirect(303, redirectTo);
	}
};

/** Empêche les redirections ouvertes : uniquement des chemins internes /admin. */
function safeRedirect(value: string | null | undefined): string {
	if (value && value.startsWith('/admin') && !value.startsWith('/admin/login')) {
		return value;
	}
	return '/admin';
}

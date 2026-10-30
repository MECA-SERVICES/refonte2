import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions } from './$types';
import { auth } from '$lib/server/auth';

/** Longueur minimale (CDC 07, R11), comme `emailAndPassword` dans `auth.ts`. */
const MIN_PASSWORD = 8;

export const actions: Actions = {
	/** Le membre connecté remplace son mot de passe (le provisoire reçu, par exemple). */
	changePassword: async ({ request }) => {
		const form = await request.formData();
		const currentPassword = form.get('currentPassword')?.toString() ?? '';
		const newPassword = form.get('newPassword')?.toString() ?? '';
		if (newPassword.length < MIN_PASSWORD) {
			return fail(400, { message: `Le mot de passe compte au moins ${MIN_PASSWORD} caractères.` });
		}
		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions: true },
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: 'Mot de passe actuel incorrect.' });
			}
			return fail(500, { message: 'Erreur inattendue.' });
		}
		return { success: true };
	}
};

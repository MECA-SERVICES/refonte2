import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isLockEnabled, isUnlocked, unlock } from '$lib/server/site-lock';

export const load: PageServerLoad = ({ cookies }) => {
	// Verrou levé ou déjà déverrouillé : la page n'a plus lieu d'être.
	if (!isLockEnabled() || isUnlocked(cookies)) redirect(303, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const password = form.get('password')?.toString() ?? '';

		if (!unlock(cookies, password)) {
			return fail(401, { message: 'Mot de passe incorrect.' });
		}

		redirect(303, '/');
	}
};

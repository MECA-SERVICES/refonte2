import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import {
	createCustomerProfile,
	parseRegistration,
	type FieldErrors,
	type RegistrationInput
} from '$lib/server/account';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/compte');
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const { values, password, errors } = parseRegistration(form);

		const invalid = (status: number, values: RegistrationInput, errors: FieldErrors) =>
			fail(status, { values, errors });

		if (Object.keys(errors).length > 0) {
			return invalid(400, values, errors);
		}

		let userId: string;
		try {
			// Better Auth crée l'identité de connexion ; le rôle `customer` est
			// appliqué par défaut (règles R2 et R8 de la section 07).
			const result = await auth.api.signUpEmail({
				body: {
					email: values.email,
					password,
					name: `${values.firstName} ${values.lastName}`.trim()
				},
				headers: event.request.headers
			});
			userId = result.user.id;
		} catch (error) {
			if (error instanceof APIError) {
				const exists = error.body?.code === 'USER_ALREADY_EXISTS';
				return invalid(
					409,
					values,
					exists
						? { email: 'Un compte existe déjà avec cette adresse email.' }
						: { form: error.body?.message ?? 'La création du compte a échoué.' }
				);
			}
			throw error;
		}

		// La fiche commerciale complète l'identité de connexion (section 08).
		await createCustomerProfile(userId, values);

		// Un compte professionnel ou de collectivité reste à valider par l'équipe.
		redirect(303, values.type === 'particulier' ? '/compte' : '/compte?validation=attente');
	}
};

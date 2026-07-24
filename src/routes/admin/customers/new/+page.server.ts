import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { auth } from '$lib/server/auth';
import { createCustomer, parseCustomerForm } from '$lib/server/customers';
import { APIError } from 'better-auth/api';

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const parsed = parseCustomerForm(form);
		if ('error' in parsed) {
			return fail(400, { message: parsed.error });
		}
		const { values } = parsed;

		let userId: string;
		try {
			// Un client est adossé à un compte better-auth (rôle "customer").
			// Mot de passe temporaire : le client le réinitialisera via "mot de passe oublié".
			const tempPassword = crypto.randomUUID();
			// role omis volontairement : defaultRole ("customer") s'applique.
			const created = await auth.api.createUser({
				body: {
					email: values.email,
					password: tempPassword,
					name: `${values.firstName} ${values.lastName}`
				},
				headers: event.request.headers
			});
			userId = created.user.id;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Impossible de créer le compte.' });
			}
			return fail(500, { message: 'Erreur inattendue lors de la création du compte.' });
		}

		const customer = await createCustomer({ ...values, userId });
		throw redirect(303, `/admin/customers/${customer.id}`);
	}
};

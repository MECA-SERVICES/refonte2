import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	decideValidationRequest,
	getValidationRequest,
	listRequestsForCustomer,
	parseDecisionForm,
	ValidationError
} from '$lib/server/account-validation';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Demande introuvable');

	const row = await getValidationRequest(id);
	if (!row) error(404, 'Demande introuvable');

	return {
		request: row.request,
		customer: row.customer,
		reviewerName: row.reviewerName,
		// R10 : l'historique montre les dossiers précédents du même client.
		history: await listRequestsForCustomer(row.customer.id)
	};
};

export const actions: Actions = {
	decide: async ({ params, request, locals }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) error(404, 'Demande introuvable');

		const parsed = parseDecisionForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		try {
			await decideValidationRequest(id, { ...parsed, reviewerId: locals.user?.id ?? null });
		} catch (err) {
			// Erreur métier : motif manquant, dossier déjà traité…
			if (err instanceof ValidationError) return fail(400, { message: err.message });
			throw err;
		}

		return { decided: parsed.decision };
	}
};

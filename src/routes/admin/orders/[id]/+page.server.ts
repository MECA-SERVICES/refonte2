import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getOrderFull, listOrderStates, changeOrderState } from '$lib/server/orders';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Commande introuvable');

	const [order, states] = await Promise.all([getOrderFull(id), listOrderStates()]);
	if (!order) throw error(404, 'Commande introuvable');

	return {
		order,
		states: states.map((s) => ({ id: s.id, label: s.label, color: s.color }))
	};
};

export const actions: Actions = {
	changeState: async ({ request, params, locals }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'Commande introuvable');

		const form = await request.formData();
		const stateId = Number(form.get('stateId'));
		if (!Number.isInteger(stateId)) return fail(400, { message: 'État invalide.' });

		await changeOrderState({
			orderId: id,
			stateId,
			changedBy: locals.user?.id ?? null,
			note: form.get('note')?.toString().trim() || null
		});
		return { success: true };
	}
};

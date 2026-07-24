import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getOrderState,
	updateOrderState,
	deleteOrderState,
	parseOrderStateForm
} from '$lib/server/orders';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'État introuvable');

	const state = await getOrderState(id);
	if (!state) throw error(404, 'État introuvable');

	return { state };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'État introuvable');

		const parsed = parseOrderStateForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		await updateOrderState(id, parsed.values);
		throw redirect(303, '/admin/order-states');
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await deleteOrderState(id);
		throw redirect(303, '/admin/order-states');
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createOrderState, parseOrderStateForm } from '$lib/server/orders';

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseOrderStateForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		await createOrderState(parsed.values);
		throw redirect(303, '/admin/order-states');
	}
};

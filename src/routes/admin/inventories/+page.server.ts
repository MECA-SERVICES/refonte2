import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createInventory, InventoryError, listInventories } from '$lib/server/inventory';

export const load: PageServerLoad = async () => ({ inventories: await listInventories() });

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		let id: number;
		try {
			id = await createInventory(form.get('name')?.toString() ?? '');
		} catch (err) {
			if (err instanceof InventoryError) return fail(400, { message: err.message });
			throw err;
		}
		redirect(303, `/admin/inventories/${id}`);
	}
};

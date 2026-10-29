import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteRemittance, getRemittance, SettlementError } from '$lib/server/settlements';

function idParam(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Bordereau introuvable');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const remittance = await getRemittance(idParam(params));
	if (!remittance) error(404, 'Bordereau introuvable');
	return { remittance };
};

export const actions: Actions = {
	/** Bordereau saisi par erreur : ses règlements retournent en caisse. */
	delete: async ({ params }) => {
		try {
			await deleteRemittance(idParam(params));
		} catch (err) {
			if (err instanceof SettlementError) return fail(400, { message: err.message });
			throw err;
		}
		redirect(303, '/admin/remittances');
	}
};

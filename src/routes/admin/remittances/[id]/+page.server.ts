import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteRemittance, getRemittance } from '$lib/server/settlements';

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
		await deleteRemittance(idParam(params));
		redirect(303, '/admin/remittances');
	}
};

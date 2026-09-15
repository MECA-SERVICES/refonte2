import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCustomer } from '../guard';
import {
	confirmMachine,
	createMachine,
	deleteMachine,
	EQUIPMENT_TYPES,
	listMachines,
	MachineError,
	parseMachineForm,
	updateMachine
} from '$lib/server/machines';

export const load: PageServerLoad = async ({ locals, url }) => {
	const profile = await requireCustomer(locals, url.pathname);
	const search = url.searchParams.get('q')?.trim() || undefined;

	return {
		machines: await listMachines(profile.id, search),
		equipmentTypes: EQUIPMENT_TYPES,
		search: search ?? ''
	};
};

export const actions: Actions = {
	save: async ({ locals, request, url }) => {
		const profile = await requireCustomer(locals, url.pathname);
		const form = await request.formData();

		const parsed = parseMachineForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const id = Number(form.get('id'));
		try {
			if (id) {
				const updated = await updateMachine(profile.id, id, parsed.values);
				// Machine inexistante ou appartenant à un tiers : même réponse (R1).
				if (!updated) return fail(404, { message: 'Machine introuvable.' });
			} else {
				await createMachine(profile.id, parsed.values);
			}
			return { saved: true };
		} catch (cause) {
			// Numéro de série déjà employé dans le parc (R17).
			if (cause instanceof MachineError) return fail(400, { message: cause.message });
			throw cause;
		}
	},

	/** Confirme une machine proposée automatiquement (R12, R18). */
	confirm: async ({ locals, request, url }) => {
		const profile = await requireCustomer(locals, url.pathname);
		const form = await request.formData();

		const id = Number(form.get('id'));
		const serialNumber = form.get('serialNumber')?.toString().trim();
		if (!id) return fail(400, { message: 'Machine introuvable.' });
		if (!serialNumber) {
			return fail(400, { message: 'Le numéro de série est requis pour confirmer la machine.' });
		}

		try {
			const confirmed = await confirmMachine(profile.id, id, {
				serialNumber,
				name: form.get('name')?.toString().trim() || undefined
			});
			if (!confirmed) return fail(404, { message: 'Machine introuvable.' });
			return { confirmed: true };
		} catch (cause) {
			if (cause instanceof MachineError) return fail(400, { message: cause.message });
			throw cause;
		}
	},

	/** Suppression, qui vaut aussi refus d'une proposition automatique (R13). */
	delete: async ({ locals, request, url }) => {
		const profile = await requireCustomer(locals, url.pathname);
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { message: 'Machine introuvable.' });

		const removed = await deleteMachine(profile.id, id);
		if (!removed) return fail(404, { message: 'Machine introuvable.' });

		return { deleted: true };
	}
};

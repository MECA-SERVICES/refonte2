import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createEquipmentType,
	deleteEquipmentType,
	EquipmentTypeError,
	listEquipmentTypes,
	moveEquipmentType,
	renameEquipmentType,
	setEquipmentTypeActive
} from '$lib/server/equipment-types';

export const load: PageServerLoad = async () => ({ types: await listEquipmentTypes() });

/** Identifiant du type visé par l'action. */
function typeId(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

/** Exécute une action et traduit les refus métier en message. */
async function run(task: () => Promise<void>) {
	try {
		await task();
		return { success: true };
	} catch (err) {
		if (err instanceof EquipmentTypeError) return fail(400, { message: err.message });
		throw err;
	}
}

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		return run(() => createEquipmentType(form.get('name')?.toString() ?? ''));
	},

	rename: async ({ request }) => {
		const form = await request.formData();
		const id = typeId(form);
		if (!id) return fail(400, { message: 'Type introuvable.' });
		return run(() => renameEquipmentType(id, form.get('name')?.toString() ?? ''));
	},

	toggle: async ({ request }) => {
		const form = await request.formData();
		const id = typeId(form);
		if (!id) return fail(400, { message: 'Type introuvable.' });
		return run(() => setEquipmentTypeActive(id, form.get('active') === 'true'));
	},

	move: async ({ request }) => {
		const form = await request.formData();
		const id = typeId(form);
		if (!id) return fail(400, { message: 'Type introuvable.' });
		return run(() => moveEquipmentType(id, form.get('direction') === 'up' ? 'up' : 'down'));
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = typeId(form);
		if (!id) return fail(400, { message: 'Type introuvable.' });
		return run(() => deleteEquipmentType(id));
	}
};

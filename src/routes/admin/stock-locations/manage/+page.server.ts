import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createStockLocation,
	deleteStockLocation,
	listStockLocations,
	parseLocationForm,
	StockLocationError,
	updateStockLocation
} from '$lib/server/stock-locations';

/**
 * Paramètres › Emplacements de stock : créer, renommer, ranger, désactiver et
 * supprimer les emplacements. Le contenu (produits, déplacements) se gère dans
 * Catalogue › Emplacements de stock.
 */
export const load: PageServerLoad = async () => ({ locations: await listStockLocations() });

/** Identifiant positif lu dans le formulaire, ou null. */
function idField(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

/** Exécute une action et traduit les refus métier en message. */
async function run<T>(task: () => Promise<T>) {
	try {
		return { success: true, result: await task() };
	} catch (err) {
		if (err instanceof StockLocationError) return fail(400, { message: err.message });
		throw err;
	}
}

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseLocationForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		return run(() => createStockLocation(parsed.values));
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = idField(form);
		if (!id) return fail(400, { message: 'Emplacement introuvable.' });
		const parsed = parseLocationForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.error });
		return run(() => updateStockLocation(id, parsed.values));
	},

	delete: async ({ request }) => {
		const id = idField(await request.formData());
		if (!id) return fail(400, { message: 'Emplacement introuvable.' });
		return run(() => deleteStockLocation(id));
	}
};

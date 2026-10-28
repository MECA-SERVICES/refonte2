import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addCount,
	getInventory,
	getInventoryGaps,
	InventoryError,
	listCounts,
	parseCountForm,
	removeCountSerial,
	searchCountableProducts,
	setCountQuantity,
	validateInventory
} from '$lib/server/inventory';
import { listStockLocations, StockLocationError } from '$lib/server/stock-locations';
import { isInventoryScope } from '$lib/inventory';

/**
 * `?q=` : produit cherché pour le comptage (référence, EAN, nom).
 * `?scope=` : portée des écarts affichés (`all` ou `counted-locations`).
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const id = Number(params.id);
	const inv = Number.isInteger(id) ? await getInventory(id) : null;
	if (!inv) error(404, 'Inventaire introuvable');

	const q = url.searchParams.get('q')?.trim() ?? '';
	const scopeParam = url.searchParams.get('scope');
	const scope = isInventoryScope(scopeParam) ? scopeParam : 'all';
	const [counts, locations, found, gaps] = await Promise.all([
		listCounts(id),
		listStockLocations(),
		inv.status === 'open' ? searchCountableProducts(q) : [],
		inv.status === 'open' ? getInventoryGaps(id, scope) : []
	]);
	return { inventory: inv, counts, locations, q, found, scope, gaps };
};

/** Exécute une action et traduit les refus métier en message. */
async function run(task: () => Promise<unknown>) {
	try {
		const result = await task();
		return { success: true, result };
	} catch (err) {
		if (err instanceof InventoryError || err instanceof StockLocationError) {
			return fail(400, { message: err.message });
		}
		throw err;
	}
}

export const actions: Actions = {
	count: async ({ request, params, locals }) => {
		const form = await request.formData();
		return run(() => addCount(parseCountForm(form, Number(params.id), locals.user?.id ?? null)));
	},

	setQuantity: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			setCountQuantity(Number(params.id), Number(form.get('lineId')), Number(form.get('quantity')))
		);
	},

	removeSerial: async ({ request, params }) => {
		const form = await request.formData();
		return run(() => removeCountSerial(Number(params.id), Number(form.get('serialId'))));
	},

	validate: async ({ request, params, locals }) => {
		const form = await request.formData();
		const scope = form.get('scope');
		if (!isInventoryScope(scope)) return fail(400, { message: 'Portée de validation inconnue.' });
		return run(() => validateInventory(Number(params.id), scope, locals.user?.id ?? null));
	}
};

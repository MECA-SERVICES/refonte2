import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getStockOverview,
	listStockLocations,
	listStoredProducts,
	parseTransferForm,
	searchStoredProducts,
	StockLocationError,
	transferStock
} from '$lib/server/stock-locations';
import { subtreeIds } from '$lib/stock-locations';

/**
 * `?id=` : l'emplacement ouvert, avec les produits de tout son sous-arbre.
 * `?q=` : recherche « où est rangé ce produit ? ».
 */
export const load: PageServerLoad = async ({ url }) => {
	const locations = await listStockLocations();
	const selectedId = Number(url.searchParams.get('id')) || null;
	const q = url.searchParams.get('q')?.trim() ?? '';

	if (selectedId !== null && !locations.some((l) => l.id === selectedId)) {
		error(404, 'Emplacement introuvable');
	}

	const [overview, stored, found] = await Promise.all([
		getStockOverview(),
		selectedId === null ? [] : listStoredProducts(subtreeIds(locations, selectedId)),
		q.length >= 2 ? searchStoredProducts(q) : []
	]);
	return { locations, overview, selectedId, stored, q, found };
};

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
	/** Déplace les produits sélectionnés vers un autre emplacement. */
	transfer: async ({ request, locals }) => {
		const parsed = parseTransferForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		return run(() => transferStock(parsed.values, locals.user?.id ?? null));
	}
};

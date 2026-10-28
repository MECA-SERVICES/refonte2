import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/guard';
import { exportInventoryCsv, getInventory } from '$lib/server/inventory';
import { slugify } from '$lib/server/slug';

/**
 * Inventaire en CSV, pour le comptable. La garde est explicite :
 * `+layout.server.ts` ne s'applique pas aux routes serveur.
 */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const id = Number(event.params.id);
	const inv = Number.isInteger(id) ? await getInventory(id) : null;
	if (!inv) error(404, 'Inventaire introuvable');
	return new Response(await exportInventoryCsv(id), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${slugify(inv.name) || 'inventaire'}.csv"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

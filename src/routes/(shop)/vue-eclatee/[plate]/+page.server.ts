import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DEMO_PLATE, DEMO_PLATES } from '$lib/demo/exploded-view';

export const load: PageServerLoad = async ({ params }) => {
	// Une seule planche de démonstration pour l'instant : les autres slugs
	// renvoient un 404 plutôt qu'une page vide trompeuse.
	if (params.plate !== DEMO_PLATE.slug) error(404, 'Planche introuvable');

	return { plate: DEMO_PLATE, plates: DEMO_PLATES };
};

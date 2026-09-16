import type { PageServerLoad } from './$types';
import { shopBrandIndex } from '$lib/server/shop';

export const load: PageServerLoad = async () => {
	// Un millier de lignes : c'est assez léger pour être envoyé en une fois, ce
	// qui permet de filtrer côté client sans aller-retour réseau à chaque frappe.
	const brands = await shopBrandIndex();
	return { brands };
};

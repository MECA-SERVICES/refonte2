import type { LayoutServerLoad } from './$types';
import { getShopMenu } from '$lib/server/shop';

export const load: LayoutServerLoad = async ({ locals, setHeaders }) => {
	// Cache côté navigateur : 5 minutes (menu change rarement)
	setHeaders({
		'Cache-Control': 'public, max-age=300'
	});

	return {
		menu: await getShopMenu(),
		// Client connecté (better-auth) — null pour les visiteurs.
		shopUser: locals.user ? { name: locals.user.name } : null
	};
};

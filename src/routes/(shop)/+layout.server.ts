import type { LayoutServerLoad } from './$types';
import { getShopMenu } from '$lib/server/shop';
import { countCartItems } from '$lib/server/cart';
import { resolveCartOwner } from '$lib/server/cart-session';

export const load: LayoutServerLoad = async (event) => {
	const { locals } = event;

	// Pas de cache HTTP ici : la réponse porte le compteur de panier, qui doit
	// refléter l'état courant à chaque navigation. Le menu, lui, est mis en
	// cache côté serveur par `getShopMenu`.
	const owner = await resolveCartOwner(event);

	return {
		menu: await getShopMenu(),
		// Client connecté (better-auth) — null pour les visiteurs.
		shopUser: locals.user ? { name: locals.user.name } : null,
		cartCount: owner ? await countCartItems(owner) : 0
	};
};

import type { LayoutServerLoad } from './$types';
import { getShopMenu } from '$lib/server/shop';
import { countCartItems } from '$lib/server/cart';
import { resolveCartOwner } from '$lib/server/cart-session';
import { taxContextForUser } from '$lib/server/account';

export const load: LayoutServerLoad = async (event) => {
	const { locals } = event;

	// Pas de cache HTTP ici : la réponse porte le compteur de panier, qui doit
	// refléter l'état courant à chaque navigation. Le menu, lui, est mis en
	// cache côté serveur par `getShopMenu`.
	const owner = await resolveCartOwner(event);

	// Régime de TVA et mode d'affichage HT/TTC, résolus une fois pour toute la
	// navigation (CDC 23, R1-R3 et P2-P3).
	const tax = await taxContextForUser(locals.user?.id);

	return {
		menu: await getShopMenu(),
		tax,
		// Client connecté (better-auth) — null pour les visiteurs.
		shopUser: locals.user ? { name: locals.user.name } : null,
		cartCount: owner ? await countCartItems(owner) : 0
	};
};

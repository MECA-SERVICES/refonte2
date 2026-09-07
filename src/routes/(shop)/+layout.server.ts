import type { LayoutServerLoad } from './$types';
import { getShopMenu } from '$lib/server/shop';
import { countCartItems } from '$lib/server/cart';
import { resolveCartOwner } from '$lib/server/cart-session';

export const load: LayoutServerLoad = async (event) => {
	const { locals, setHeaders } = event;

	// Le menu change rarement : mise en cache navigateur 5 minutes. Le compteur
	// de panier étant propre à chaque visiteur, la réponse reste privée.
	setHeaders({ 'Cache-Control': 'private, max-age=300' });

	const owner = await resolveCartOwner(event);

	return {
		menu: await getShopMenu(),
		// Client connecté (better-auth) — null pour les visiteurs.
		shopUser: locals.user ? { name: locals.user.name } : null,
		cartCount: owner ? await countCartItems(owner) : 0
	};
};

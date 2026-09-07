import type { RequestEvent } from '@sveltejs/kit';
import {
	CART_COOKIE,
	CART_COOKIE_MAX_AGE,
	customerIdForUser,
	mergeGuestCart,
	type CartOwner
} from '$lib/server/cart';

/**
 * Résolution du porteur de panier pour une requête donnée.
 *
 * Un client connecté possède un panier rattaché à sa fiche client ; un visiteur
 * en possède un rattaché au jeton déposé en cookie. À la première requête
 * authentifiée, le panier visiteur est fusionné dans celui du compte (règle R2
 * de la section 18), puis le cookie est retiré.
 */

/** Options communes du cookie de panier. */
const COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	secure: process.env.NODE_ENV === 'production',
	maxAge: CART_COOKIE_MAX_AGE
} as const;

/**
 * Porteur du panier, sans rien créer en base.
 * `create: false` (défaut) : aucun cookie n'est posé si le visiteur n'en a pas
 * encore — la lecture d'un panier inexistant ne doit pas générer de jeton.
 */
export async function resolveCartOwner(
	event: RequestEvent,
	options: { create?: boolean } = {}
): Promise<CartOwner | null> {
	const token = event.cookies.get(CART_COOKIE);

	if (event.locals.user) {
		const customerId = await customerIdForUser(event.locals.user.id);
		// Un compte sans fiche client ne peut pas encore porter de panier.
		if (customerId == null) return null;

		if (token) {
			await mergeGuestCart(token, customerId);
			event.cookies.delete(CART_COOKIE, { path: '/' });
		}
		return { customerId };
	}

	if (token) return { sessionToken: token };
	if (!options.create) return null;

	const fresh = crypto.randomUUID();
	event.cookies.set(CART_COOKIE, fresh, COOKIE_OPTIONS);
	return { sessionToken: fresh };
}

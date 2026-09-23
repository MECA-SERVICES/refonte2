import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { customerForUser } from '$lib/server/account';
import { db } from '$lib/server/db';
import { order, orderState } from '$lib/server/db/order.schema';
import { and, eq } from 'drizzle-orm';

/**
 * Retour du client depuis la page de paiement — CDC section 20.
 *
 * **Purement informatif.** Ce canal n'est pas probant : le client peut fermer
 * sa fenêtre avant d'y arriver, ou forger l'appel. Rien n'est décidé ici —
 * l'état affiché est celui que la notification serveur a déjà écrit.
 *
 * Il en découle un cas courant : le client arrive avant la notification, et
 * voit sa commande encore en attente. La page l'annonce plutôt que de laisser
 * croire à un échec.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/connexion?redirectTo=${encodeURIComponent(url.pathname)}`);

	const profile = await customerForUser(locals.user.id);
	if (!profile) redirect(303, '/compte');

	const [found] = await db
		.select({
			reference: order.reference,
			totalTtc: order.totalTtc,
			paidAt: order.paidAt,
			stateCode: orderState.code,
			stateLabel: orderState.label
		})
		.from(order)
		.innerJoin(orderState, eq(order.stateId, orderState.id))
		.where(and(eq(order.reference, params.reference), eq(order.customerId, profile.id)))
		.limit(1);

	if (!found) error(404, 'Commande introuvable');

	// Le paiement est confirmé : la confirmation de commande fait foi.
	if (found.paidAt) redirect(303, `/commande/confirmation/${found.reference}`);

	return {
		reference: found.reference,
		totalTtc: found.totalTtc,
		stateLabel: found.stateLabel,
		/** Le paiement a échoué, par opposition à une notification en retard. */
		failed: found.stateCode === 'erreur-de-paiement'
	};
};

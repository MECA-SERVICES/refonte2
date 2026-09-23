import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { customerForUser } from '$lib/server/account';
import { db } from '$lib/server/db';
import { order } from '$lib/server/db/order.schema';
import { and, eq } from 'drizzle-orm';
import { buildPaymentForm, isMoneticoConfigured, moneticoConfig } from '$lib/server/monetico';
import { logTransaction, markAwaitingPayment } from '$lib/server/payments';

/**
 * Départ vers la page de paiement Monetico — CDC section 20.
 *
 * La page ne contient qu'un formulaire scellé, soumis automatiquement : c'est
 * le navigateur du client qui transporte les champs jusqu'à la banque. Le
 * sceau est calculé côté serveur et les valeurs partent telles quelles.
 */
export const load: PageServerLoad = async ({ locals, params, url, getClientAddress }) => {
	if (!locals.user) redirect(303, `/connexion?redirectTo=${encodeURIComponent(url.pathname)}`);

	const profile = await customerForUser(locals.user.id);
	if (!profile) redirect(303, '/compte');

	// La commande est lue sous son propriétaire : une référence devinée ne
	// donne accès à rien.
	const [found] = await db
		.select()
		.from(order)
		.where(and(eq(order.reference, params.reference), eq(order.customerId, profile.id)))
		.limit(1);

	if (!found) error(404, 'Commande introuvable');

	// Une commande déjà réglée ne repart pas en paiement : le client est
	// renvoyé vers sa confirmation.
	if (found.paidAt) redirect(303, `/commande/confirmation/${found.reference}`);

	if (!isMoneticoConfigured()) {
		error(503, 'Le paiement par carte est momentanément indisponible.');
	}

	const config = moneticoConfig();
	const form = buildPaymentForm(config, {
		reference: found.reference,
		amount: Number(found.totalTtc),
		email: profile.email,
		successUrl: `${url.origin}/commande/retour/${found.reference}`,
		errorUrl: `${url.origin}/commande/retour/${found.reference}`
	});

	await markAwaitingPayment(found.id, locals.user.email ?? 'client');

	// Le formulaire émis est journalisé : sans lui, un litige sur le montant
	// transmis serait indémontrable. Le sceau y figure, jamais la clé.
	await logTransaction({
		orderId: found.id,
		reference: found.reference,
		direction: 'outgoing',
		rawPayload: JSON.stringify(form.fields),
		signatureExpected: form.fields.MAC,
		remoteIp: (() => {
			try {
				return getClientAddress();
			} catch {
				return null;
			}
		})()
	});

	return {
		action: form.url,
		fields: form.fields,
		reference: found.reference,
		totalTtc: found.totalTtc
	};
};

import type { RequestHandler } from './$types';
import { acknowledgement } from '$lib/server/monetico';
import { handlePaymentNotification } from '$lib/server/payments';

/**
 * Interface « Retour » de Monetico — CDC section 20.
 *
 * Notification serveur-à-serveur : **seul canal qui fait foi**. Le retour
 * navigateur n'est qu'un affichage ; c'est ici, et ici seulement, que la
 * commande est réglée.
 *
 * La réponse est un accusé de réception au format texte, qui ne dépend que de
 * la validité du sceau (§1.5.2 de la documentation technique) — jamais de
 * l'issue du traitement ni du code-retour. Sans lui, la banque alerte par
 * courriel et rejoue la notification.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rawBody = await request.text();
	const params = Object.fromEntries(new URLSearchParams(rawBody));

	let remoteIp: string | null = null;
	try {
		remoteIp = getClientAddress();
	} catch {
		// Selon le déploiement, l'adresse peut être indisponible : ce n'est pas
		// une raison de refuser la notification.
	}

	const verdict = await handlePaymentNotification(params, { rawBody, remoteIp });

	/*
	 * Toujours 200, même sceau invalide : le code HTTP ne porte pas le verdict,
	 * c'est le corps de la réponse qui l'exprime. Un statut d'erreur ferait
	 * rejouer indéfiniment un message que nous avons bel et bien reçu.
	 */
	return new Response(acknowledgement(verdict.valid), {
		status: 200,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
};

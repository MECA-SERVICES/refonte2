import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Point d'entrée « Nous contacter » de la boutique.
 *
 * Écrire au service client demande d'être connecté : la demande est rattachée
 * au compte et suivie depuis l'espace client. Le contexte (produit, commande)
 * est transmis tel quel au formulaire.
 */
export const load: PageServerLoad = ({ url }) => {
	redirect(303, `/compte/messages/nouveau${url.search}`);
};

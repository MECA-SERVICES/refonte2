import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Adresse inconnue de la boutique.
 *
 * Sans cette route, SvelteKit rendrait sa page d'erreur racine, hors du
 * layout de la boutique : le visiteur perdrait l'en-tête, la recherche et le
 * menu des rayons au moment précis où il cherche son chemin.
 */
export const load: PageServerLoad = () => {
	error(404, 'Page introuvable');
};

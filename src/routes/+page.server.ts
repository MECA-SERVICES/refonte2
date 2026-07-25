import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// La boutique publique n'existe pas encore : on renvoie vers le back-office.
// À remplacer par la page d'accueil boutique lors de la reprise du front.
export const load: PageServerLoad = () => {
	redirect(302, '/admin');
};

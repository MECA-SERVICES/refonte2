import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Les statistiques ont rejoint le tableau de bord (demande client 13.1). Les
 * anciens liens (`?jours=90`) y mènent, sur la période équivalente.
 */
export const load: PageServerLoad = ({ url }) => {
	const days = url.searchParams.get('jours');
	const preset = { '7': '7j', '30': '30j', '90': '90j', '365': '12m' }[days ?? ''];
	redirect(301, preset ? `/admin?periode=${preset}` : '/admin');
};

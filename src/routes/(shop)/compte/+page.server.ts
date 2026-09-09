import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { customerForUser } from '$lib/server/account';
import { listCustomerOrders } from '$lib/server/customer-orders';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/connexion?redirectTo=${encodeURIComponent(url.pathname)}`);

	const profile = await customerForUser(locals.user.id);

	return {
		account: { name: locals.user.name, email: locals.user.email },
		// Aperçu : le détail complet vit sur /compte/commandes.
		recentOrders: profile ? await listCustomerOrders(profile.id, { limit: 3 }) : [],
		profile: profile
			? {
					firstName: profile.firstName,
					lastName: profile.lastName,
					phone: profile.phone,
					type: profile.type,
					status: profile.status,
					companyName: profile.companyName,
					siret: profile.siret,
					vatNumber: profile.vatNumber,
					collectivityName: profile.collectivityName
				}
			: null,
		// Affiché au retour d'une inscription professionnelle.
		justRegistered: url.searchParams.get('validation') === 'attente'
	};
};

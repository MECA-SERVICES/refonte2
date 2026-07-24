import type { LayoutServerLoad } from './$types';
import { requireAdmin } from '$lib/server/guard';

export const load: LayoutServerLoad = (event) => {
	// La page de login ne doit pas être protégée (sinon boucle de redirection).
	if (event.url.pathname === '/admin/login') {
		return { adminUser: null };
	}

	const user = requireAdmin(event);
	return {
		adminUser: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role ?? null
		}
	};
};

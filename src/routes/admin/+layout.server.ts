import type { LayoutServerLoad } from './$types';
import { requireStaff } from '$lib/server/guard';
import { countUnreadForStaff } from '$lib/server/support';

export const load: LayoutServerLoad = async (event) => {
	// La page de login ne doit pas être protégée (sinon boucle de redirection).
	if (event.url.pathname === '/admin/login') {
		return { adminUser: null, supportUnread: 0 };
	}

	const user = requireStaff(event);
	return {
		adminUser: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role ?? null
		},
		supportUnread: await countUnreadForStaff()
	};
};

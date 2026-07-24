import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

type ListedUser = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
	createdAt: Date | string;
};

export const load: PageServerLoad = async ({ url, request }) => {
	const search = url.searchParams.get('q') ?? '';

	const result = await auth.api.listUsers({
		query: {
			limit: 100,
			sortBy: 'createdAt',
			sortDirection: 'desc',
			...(search ? { searchField: 'email', searchValue: search } : {})
		},
		headers: request.headers
	});

	const users = (result.users ?? []) as ListedUser[];
	return {
		users: users.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			role: u.role ?? 'customer',
			banned: !!u.banned
		})),
		search
	};
};

export const actions: Actions = {
	setRole: async ({ request }) => {
		const form = await request.formData();
		const userId = form.get('userId')?.toString();
		const role = form.get('role')?.toString();
		if (!userId || (role !== 'admin' && role !== 'customer')) {
			return fail(400, { message: 'Paramètres invalides.' });
		}
		try {
			// Le type de setRole ne connaît que les rôles par défaut ("user"/"admin"),
			// mais "customer" (notre defaultRole) est valide au runtime.
			await auth.api.setRole({
				body: { userId, role: role as 'admin' },
				headers: request.headers
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: error.message });
			return fail(500, { message: 'Erreur inattendue.' });
		}
		return { success: true };
	},

	toggleBan: async ({ request }) => {
		const form = await request.formData();
		const userId = form.get('userId')?.toString();
		const banned = form.get('banned')?.toString() === 'true';
		if (!userId) return fail(400, { message: 'Utilisateur invalide.' });
		try {
			if (banned) {
				await auth.api.unbanUser({ body: { userId }, headers: request.headers });
			} else {
				await auth.api.banUser({ body: { userId }, headers: request.headers });
			}
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: error.message });
			return fail(500, { message: 'Erreur inattendue.' });
		}
		return { success: true };
	}
};

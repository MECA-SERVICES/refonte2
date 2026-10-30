import { fail } from '@sveltejs/kit';
import { and, asc, eq, ilike, inArray, ne, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { isStaffRole, staffRoles, type StaffRole } from '$lib/roles';
import { APIError } from 'better-auth/api';

/** Longueur minimale (CDC 07, R11), comme `emailAndPassword` dans `auth.ts`. */
const MIN_PASSWORD = 8;

/**
 * Équipe (CDC 34, réservée aux administrateurs) : sans recherche, les comptes
 * internes ; avec `?q=`, tous les comptes dont l'e-mail correspond, pour
 * donner l'accès au back-office à un compte existant.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const search = url.searchParams.get('q')?.trim() ?? '';
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			banned: user.banned
		})
		.from(user)
		.where(search ? ilike(user.email, `%${search}%`) : inArray(user.role, [...staffRoles]))
		.orderBy(asc(user.name))
		.limit(100);
	return {
		users: rows.map((u) => ({
			...u,
			role: u.role ?? 'customer',
			banned: !!u.banned,
			isMe: u.id === locals.user?.id
		})),
		search
	};
};

/** Exécute un appel better-auth et traduit son refus en message. */
async function run(task: () => Promise<unknown>) {
	try {
		await task();
	} catch (error) {
		if (error instanceof APIError) return fail(400, { message: error.message });
		return fail(500, { message: 'Erreur inattendue.' });
	}
	return { success: true };
}

/** Le dernier administrateur actif ne perd jamais son rôle ni son accès (R11). */
async function isLastAdmin(userId: string) {
	const others = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(eq(user.role, 'admin'), sql`coalesce(${user.banned}, false) = false`, ne(user.id, userId))
		)
		.limit(1);
	return others.length === 0;
}

const shortPassword = `Le mot de passe compte au moins ${MIN_PASSWORD} caractères.`;

export const actions: Actions = {
	/** Rôle interne d'un compte : employé ou administrateur (R3). */
	setRole: async ({ request, locals }) => {
		const form = await request.formData();
		const userId = form.get('userId')?.toString();
		const role = form.get('role')?.toString();
		if (!userId || !isStaffRole(role)) return fail(400, { message: 'Paramètres invalides.' });
		if (userId === locals.user?.id) {
			return fail(400, { message: 'Vous ne pouvez pas changer votre propre rôle.' });
		}
		if (role !== 'admin' && (await isLastAdmin(userId))) {
			return fail(400, { message: 'C’est le dernier administrateur : il garde son rôle.' });
		}
		// Le type de setRole ne connaît que les rôles par défaut ("user"/"admin"),
		// mais tout rôle est accepté au runtime (aucun contrôle d'accès configuré).
		return run(() =>
			auth.api.setRole({ body: { userId, role: role as 'admin' }, headers: request.headers })
		);
	},

	/** Désactive un compte (plus de connexion) ou le réactive (R5, R6). */
	toggleBan: async ({ request, locals }) => {
		const form = await request.formData();
		const userId = form.get('userId')?.toString();
		const banned = form.get('banned')?.toString() === 'true';
		if (!userId) return fail(400, { message: 'Utilisateur invalide.' });
		if (!banned && userId === locals.user?.id) {
			return fail(400, { message: 'Vous ne pouvez pas désactiver votre propre compte.' });
		}
		if (!banned && (await isLastAdmin(userId))) {
			return fail(400, { message: 'C’est le dernier administrateur : il reste actif.' });
		}
		return run(() =>
			banned
				? auth.api.unbanUser({ body: { userId }, headers: request.headers })
				: auth.api.banUser({ body: { userId }, headers: request.headers })
		);
	},

	/**
	 * Mot de passe provisoire d'un membre, défini par l'administrateur qui le
	 * lui transmet. Crée l'identifiant s'il n'en avait pas (compte repris de
	 * Dolibarr ou de PrestaShop).
	 */
	setPassword: async ({ request }) => {
		const form = await request.formData();
		const userId = form.get('userId')?.toString();
		const newPassword = form.get('password')?.toString() ?? '';
		if (!userId) return fail(400, { message: 'Utilisateur invalide.' });
		if (newPassword.length < MIN_PASSWORD) return fail(400, { message: shortPassword });
		return run(() =>
			auth.api.setUserPassword({ body: { userId, newPassword }, headers: request.headers })
		);
	},

	/** Nouveau membre de l'équipe : employé, ou administrateur. */
	addMember: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const email = form.get('email')?.toString().trim().toLowerCase() ?? '';
		const password = form.get('password')?.toString() ?? '';
		const role = form.get('role')?.toString();
		if (!name || !email) return fail(400, { message: 'Indiquez le nom et l’e-mail.' });
		if (!isStaffRole(role)) return fail(400, { message: 'Choisissez le rôle.' });
		if (password.length < MIN_PASSWORD) return fail(400, { message: shortPassword });
		return run(() =>
			auth.api.createUser({
				body: { name, email, password, role: role as StaffRole as 'admin' },
				headers: request.headers
			})
		);
	}
};

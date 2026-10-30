/**
 * Comptes de l'équipe : les utilisateurs Dolibarr retenus (`TEAM`) deviennent
 * des comptes MSShop avec accès au back-office, avec le rôle de `TEAM` :
 * administrateur (paramétrage, équipe) ou employé (`$lib/roles`).
 *
 * - Un compte MSShop au même e-mail (souvent le compte client repris de
 *   PrestaShop) reçoit ce rôle : la personne garde un seul compte.
 * - Sinon le compte est créé, sans mot de passe : les mots de passe Dolibarr ne
 *   se migrent pas. L'administrateur le définit depuis Administration › Équipe.
 * - Un utilisateur Dolibarr sans e-mail prend l'adresse de `EMAILS` ; sans
 *   adresse (STOCK-PIECE), il n'est pas repris : il se crée depuis la page
 *   Équipe, avec l'adresse choisie.
 *
 * Idempotent par e-mail.
 */
import { randomBytes } from 'node:crypto';
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

/** Logins Dolibarr repris et leur rôle (décidé le 29/10/2026). */
const TEAM: Record<string, 'admin' | 'employee'> = {
	'J.DAVY': 'admin',
	'A.CHAMBRIN': 'admin',
	CLARA2025: 'employee',
	'ABEL.H': 'employee',
	'STOCK-PIECE': 'employee'
};

/** Adresse de connexion des utilisateurs qui n'ont pas d'e-mail dans Dolibarr. */
export const EMAILS: Record<string, string> = {
	'ABEL.H': 'abel.hue@msshop.fr'
};

interface SourceUser {
	login: string;
	firstname: string | null;
	lastname: string | null;
	email: string | null;
}

export const teamTask: Task = {
	name: 'team',
	description: 'Comptes de l’équipe (llx_user → user, employé ou admin, sans mot de passe)',

	async run({ dryRun }) {
		const rows = await sourceQuery<SourceUser>(
			`SELECT login, firstname, lastname, email FROM ${DOLI}.llx_user
			 WHERE statut = 1 AND login IN (${Object.keys(TEAM)
					.map((l) => `'${l}'`)
					.join(',')})`
		);
		const users = rows.map((u) => ({ ...u, email: text(u.email) ?? EMAILS[u.login] ?? null }));
		const withEmail = users.filter((u) => text(u.email));
		const skipped = users.filter((u) => !text(u.email)).map((u) => u.login);
		log.muted(
			`${count(withEmail.length)} comptes à reprendre${skipped.length ? `, sans e-mail (à créer depuis la page Équipe) : ${skipped.join(', ')}` : ''}`
		);

		const sql = targetDb();
		const existing = await sql<{ email: string; role: string | null }[]>`
			SELECT lower(email) AS email, role FROM "user"
			WHERE lower(email) = ANY(${withEmail.map((u) => u.email!.trim().toLowerCase())})`;
		const byEmail = new Map(existing.map((u) => [u.email, u.role]));
		for (const u of withEmail) {
			const email = u.email!.trim().toLowerCase();
			const role = TEAM[u.login];
			const label = role === 'admin' ? 'administrateur' : 'employé';
			const state = byEmail.has(email)
				? byEmail.get(email) === role
					? `déjà ${label}`
					: `compte existant, passe ${label}`
				: `créé ${label}, sans mot de passe`;
			log.muted(`  ${u.login} (${email}) : ${state}`);
		}
		if (dryRun) {
			log.warn('Simulation : aucun compte modifié.');
			return { processed: 0, note: 'simulation' };
		}

		await sql.begin(async (tx) => {
			for (const u of withEmail) {
				const email = u.email!.trim().toLowerCase();
				const name = [text(u.firstname), text(u.lastname)].filter(Boolean).join(' ') || u.login;
				const role = TEAM[u.login];
				if (byEmail.has(email)) {
					await tx`
						UPDATE "user" SET role = ${role}, updated_at = now()
						WHERE lower(email) = ${email} AND role IS DISTINCT FROM ${role}`;
				} else {
					await tx`
						INSERT INTO "user" (id, name, email, email_verified, role, banned, created_at, updated_at)
						VALUES (${randomBytes(16).toString('hex')}, ${name}, ${email}, true, ${role}, false,
							now(), now())`;
				}
			}
		});
		return {
			processed: withEmail.length,
			note: `${count(withEmail.length)} comptes de l’équipe`
		};
	}
};

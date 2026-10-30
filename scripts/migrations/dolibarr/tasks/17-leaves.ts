/**
 * Congés Dolibarr → module Congés de MSShop.
 *
 * - `llx_holiday` → `leave_request` : toutes les demandes (167), anciens
 *   salariés compris ; le salarié est rattaché à son compte de l'équipe par
 *   e-mail (sinon son nom seul est gardé). Les jours ouvrés sont recalculés.
 *   À lancer après `team`.
 * - `llx_holiday_users` → `leave_balance` : soldes des congés payés et des RTT
 *   des comptes MSShop, avec le dernier mois acquis par Dolibarr.
 * - `llx_holiday_logs` → `leave_balance_log` : le journal des soldes.
 * - La numérotation continue la série `HL` de Dolibarr.
 *
 * Dolibarr fait foi jusqu'à la bascule : les soldes sont réécrits à chaque
 * reprise. Idempotent par `legacy_doli_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { isoDay, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { htmlLines } from '../lines.ts';
import { EMAILS } from './13-team.ts';
import { leaveDays } from '../../../../src/lib/leaves.ts';

interface SourceUser {
	rowid: number;
	login: string;
	firstname: string | null;
	lastname: string | null;
	email: string | null;
}

interface SourceHoliday {
	rowid: number;
	ref: string;
	fk_user: number;
	fk_type: number;
	date_create: Date;
	description: string | null;
	date_debut: Date;
	date_fin: Date;
	halfday: number;
	statut: number;
	fk_user_valid: number | null;
	date_valid: Date | null;
	date_refuse: Date | null;
	date_cancel: Date | null;
	detail_refuse: string | null;
}

interface SourceBalance {
	fk_user: number;
	fk_type: number;
	nb_holiday: number;
}

interface SourceLog {
	rowid: number;
	date_action: Date;
	fk_user_action: number;
	fk_user_update: number;
	fk_type: number;
	type_action: string;
	prev_solde: string | null;
	new_solde: string | null;
}

/** Types Dolibarr (`llx_c_holiday_types.rowid`) → `$lib/leaves`. */
const TYPES: Record<number, string> = { 1: 'sick', 2: 'other', 3: 'paid', 4: 'rtt', 5: 'paid' };
/** Un brouillon (1) n'a jamais été envoyé : il est clos comme annulé. */
const STATUSES: Record<number, string> = {
	1: 'cancelled',
	2: 'pending',
	3: 'approved',
	4: 'cancelled',
	5: 'refused'
};

export const leavesTask: Task = {
	name: 'leaves',
	description: 'Congés (llx_holiday → leave_request, soldes et journal)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const users = await sourceQuery<SourceUser>(
			`SELECT rowid, login, firstname, lastname, email FROM ${DOLI}.llx_user`
		);
		const holidays = await sourceQuery<SourceHoliday>(
			`SELECT rowid, ref, fk_user, fk_type, date_create, description, date_debut, date_fin,
			        halfday, statut, fk_user_valid, date_valid, date_refuse, date_cancel, detail_refuse
			 FROM ${DOLI}.llx_holiday ORDER BY rowid`
		);
		const balances = await sourceQuery<SourceBalance>(
			`SELECT fk_user, fk_type, nb_holiday FROM ${DOLI}.llx_holiday_users`
		);
		const logs = await sourceQuery<SourceLog>(
			`SELECT rowid, date_action, fk_user_action, fk_user_update, fk_type, type_action, prev_solde,
			        new_solde
			 FROM ${DOLI}.llx_holiday_logs ORDER BY rowid`
		);
		const [config] = await sourceQuery<{ value: string }>(
			`SELECT value FROM ${DOLI}.llx_holiday_config WHERE name = 'lastUpdate'`
		);
		// `20261002140323` : Dolibarr a acquis le mois d'octobre 2026.
		const accruedThrough = config
			? `${config.value.slice(0, 4)}-${config.value.slice(4, 6)}`
			: new Date().toISOString().slice(0, 7);
		log.muted(
			`${count(holidays.length)} demandes, ${count(balances.length)} soldes, ${count(logs.length)} mouvements ; acquis jusqu'à ${accruedThrough}`
		);

		const sql = targetDb();
		const emailOf = (u: SourceUser) => (text(u.email) ?? EMAILS[u.login])?.toLowerCase() ?? null;
		const accounts = await sql<{ id: string; email: string; name: string }[]>`
			SELECT id, lower(email) AS email, name FROM "user"
			WHERE role IN ('employee', 'admin')
				AND lower(email) = ANY(${users.map(emailOf).filter((e): e is string => !!e)})`;
		const accountOf = new Map(
			users.flatMap((u) => {
				const a = accounts.find((acc) => acc.email === emailOf(u));
				return a ? [[Number(u.rowid), a] as const] : [];
			})
		);
		const nameOf = (id: number | null) => {
			if (!id) return null;
			const u = users.find((x) => Number(x.rowid) === Number(id));
			if (!u) return null;
			return (
				accountOf.get(Number(id))?.name ??
				([text(u.firstname), text(u.lastname)].filter(Boolean).join(' ') || u.login)
			);
		};

		const requests = holidays.map((h) => {
			const start = isoDay(h.date_debut)!;
			const end = isoDay(h.date_fin)!;
			const half = Number(h.halfday);
			const startsAfternoon = half === -1 || half === 2;
			const endsAtNoon = half === 1 || half === 2;
			const status = STATUSES[Number(h.statut)] ?? 'pending';
			const decidedAt = h.date_refuse ?? h.date_cancel ?? h.date_valid;
			return {
				legacy_doli_id: Number(h.rowid),
				reference: h.ref,
				user_id: accountOf.get(Number(h.fk_user))?.id ?? null,
				employee_name: nameOf(h.fk_user) ?? `Salarié Dolibarr ${h.fk_user}`,
				type: TYPES[Number(h.fk_type)] ?? 'other',
				start_on: start,
				end_on: end,
				starts_afternoon: startsAfternoon,
				ends_at_noon: endsAtNoon,
				days: leaveDays(start, end, startsAfternoon, endsAtNoon).toFixed(2),
				status,
				description: htmlLines(h.description) || null,
				decision_note:
					htmlLines(h.detail_refuse) ||
					(Number(h.statut) === 1 ? 'Brouillon Dolibarr jamais envoyé' : null),
				decided_by: h.fk_user_valid ? (accountOf.get(Number(h.fk_user_valid))?.id ?? null) : null,
				decided_at: status !== 'pending' && decidedAt ? new Date(decidedAt).toISOString() : null,
				created_at: new Date(h.date_create).toISOString()
			};
		});
		const balanceRows = balances
			.filter(
				(b) =>
					accountOf.has(Number(b.fk_user)) && ['paid', 'rtt'].includes(TYPES[Number(b.fk_type)])
			)
			.map((b) => ({
				user_id: accountOf.get(Number(b.fk_user))!.id,
				type: TYPES[Number(b.fk_type)],
				days: Number(b.nb_holiday).toFixed(3),
				accrued_through: accruedThrough
			}));
		const logRows = logs.map((l) => ({
			legacy_doli_id: Number(l.rowid),
			user_id: accountOf.get(Number(l.fk_user_update))?.id ?? null,
			employee_name: nameOf(l.fk_user_update) ?? `Salarié Dolibarr ${l.fk_user_update}`,
			type: TYPES[Number(l.fk_type)] ?? 'other',
			previous_days: l.prev_solde !== null ? Number(l.prev_solde).toFixed(3) : null,
			new_days: l.new_solde !== null ? Number(l.new_solde).toFixed(3) : null,
			reason: l.type_action.replace(/^Congés - /, 'Congé '),
			actor_name: nameOf(l.fk_user_action),
			created_at: new Date(l.date_action).toISOString()
		}));
		const linked = new Set(requests.filter((r) => r.user_id).map((r) => r.employee_name));
		log.muted(
			`${count(requests.filter((r) => r.user_id).length)} demandes rattachées à un compte (${[...linked].join(', ')}), ${count(balanceRows.length)} soldes repris`
		);
		if (dryRun) {
			log.warn('Simulation : aucun congé repris.');
			return { processed: 0, note: 'simulation' };
		}

		await sql.begin(async (tx) => {
			await tx`
				INSERT INTO leave_request (legacy_doli_id, reference, user_id, employee_name, type, start_on,
					end_on, starts_afternoon, ends_at_noon, days, status, description, decision_note,
					decided_by, decided_at, created_at, updated_at)
				SELECT legacy_doli_id, reference, user_id, employee_name, type, start_on, end_on,
					starts_afternoon, ends_at_noon, days, status, description, decision_note, decided_by,
					decided_at, created_at, created_at
				FROM jsonb_to_recordset(${tx.json(requests)}) AS r(legacy_doli_id int, reference text,
					user_id text, employee_name text, type text, start_on date, end_on date,
					starts_afternoon boolean, ends_at_noon boolean, days numeric, status text,
					description text, decision_note text, decided_by text, decided_at timestamptz,
					created_at timestamptz)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
					user_id = excluded.user_id, employee_name = excluded.employee_name,
					type = excluded.type, start_on = excluded.start_on, end_on = excluded.end_on,
					starts_afternoon = excluded.starts_afternoon, ends_at_noon = excluded.ends_at_noon,
					days = excluded.days, status = excluded.status, description = excluded.description,
					decision_note = excluded.decision_note, decided_by = excluded.decided_by,
					decided_at = excluded.decided_at, updated_at = now()`;
			await tx`
				INSERT INTO leave_balance (user_id, type, days, accrued_through)
				SELECT user_id, type, days, accrued_through
				FROM jsonb_to_recordset(${tx.json(balanceRows)}) AS b(user_id text, type text,
					days numeric, accrued_through text)
				ON CONFLICT (user_id, type) DO UPDATE SET
					days = excluded.days, accrued_through = excluded.accrued_through, updated_at = now()`;
			await tx`
				INSERT INTO leave_balance_log (legacy_doli_id, user_id, employee_name, type, previous_days,
					new_days, reason, actor_name, created_at)
				SELECT legacy_doli_id, user_id, employee_name, type, previous_days, new_days, reason,
					actor_name, created_at
				FROM jsonb_to_recordset(${tx.json(logRows)}) AS l(legacy_doli_id int, user_id text,
					employee_name text, type text, previous_days numeric, new_days numeric, reason text,
					actor_name text, created_at timestamptz)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO NOTHING`;
			// La série continue après le dernier numéro Dolibarr (et jamais en arrière).
			await tx`
				SELECT setval('leave_number_seq', greatest(
					(SELECT last_value FROM leave_number_seq),
					coalesce((SELECT max(substring(reference from '-(\\d+)$')::int) FROM leave_request
					          WHERE reference LIKE 'HL%'), 1)
				), true)`;
		});
		return {
			processed: requests.length,
			note: `${count(requests.length)} demandes, ${count(balanceRows.length)} soldes`
		};
	}
};

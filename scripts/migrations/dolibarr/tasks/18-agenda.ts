/**
 * Agenda Dolibarr (`llx_actioncomm`) → `agenda_event`, en archive : les
 * rendez-vous, interventions et autres événements saisis par l'équipe (2021 et
 * 2022). Les traces automatiques de Dolibarr (création d'un tiers, d'un
 * produit…) ne sont pas reprises.
 *
 * Idempotent par `agenda_event.legacy_doli_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { htmlLines } from '../lines.ts';

interface SourceEvent {
	id: number;
	code: string;
	label: string | null;
	datep: Date;
	datep2: Date | null;
	fulldayevent: number;
	location: string | null;
	note: string | null;
	fk_soc: number | null;
	owner: string | null;
}

/** Événements saisis à la main, par type. */
const KINDS: Record<string, string> = {
	AC_RDV: 'Rendez-vous',
	AC_INT: 'Intervention',
	AC_OTH: 'Autre'
};

export const agendaTask: Task = {
	name: 'agenda',
	description: 'Agenda (llx_actioncomm → agenda_event, archive)',

	async run({ dryRun }) {
		const events = await sourceQuery<SourceEvent>(
			`SELECT a.id, a.code, a.label, a.datep, a.datep2, a.fulldayevent, a.location, a.note,
			        a.fk_soc, TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))) AS owner
			 FROM ${DOLI}.llx_actioncomm a
			 LEFT JOIN ${DOLI}.llx_user u ON u.rowid = a.fk_user_action
			 WHERE a.code IN ('AC_RDV', 'AC_INT', 'AC_OTH')
			 ORDER BY a.id`
		);
		const sql = targetDb();
		const customers = await sql<{ id: number; doli: number }[]>`
			SELECT id, legacy_doli_id AS doli FROM customer WHERE legacy_doli_id IS NOT NULL`;
		const customerOf = new Map(customers.map((c) => [Number(c.doli), c.id]));
		const rows = events.map((e) => ({
			legacy_doli_id: Number(e.id),
			kind: KINDS[e.code],
			title: htmlLines(e.label) || KINDS[e.code],
			starts_at: new Date(e.datep).toISOString(),
			ends_at: e.datep2 ? new Date(e.datep2).toISOString() : null,
			all_day: Number(e.fulldayevent) === 1,
			location: text(e.location),
			note: htmlLines(e.note) || null,
			customer_id: e.fk_soc ? (customerOf.get(Number(e.fk_soc)) ?? null) : null,
			owner_name: text(e.owner)
		}));
		log.muted(`${count(rows.length)} événements saisis par l'équipe`);
		if (dryRun) {
			log.warn('Simulation : aucun événement repris.');
			return { processed: 0, note: 'simulation' };
		}
		await sql`
			INSERT INTO agenda_event (legacy_doli_id, kind, title, starts_at, ends_at, all_day, location,
				note, customer_id, owner_name)
			SELECT legacy_doli_id, kind, title, starts_at, ends_at, all_day, location, note, customer_id,
				owner_name
			FROM jsonb_to_recordset(${sql.json(rows)}) AS e(legacy_doli_id int, kind text, title text,
				starts_at timestamptz, ends_at timestamptz, all_day boolean, location text, note text,
				customer_id int, owner_name text)
			ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
				kind = excluded.kind, title = excluded.title, starts_at = excluded.starts_at,
				ends_at = excluded.ends_at, all_day = excluded.all_day, location = excluded.location,
				note = excluded.note, customer_id = excluded.customer_id, owner_name = excluded.owner_name`;
		return { processed: rows.length, note: `${count(rows.length)} événements` };
	}
};

/**
 * Fiches d'intervention Dolibarr (`llx_fichinter`, `llx_fichinterdet`) →
 * ordres de réparation (`repair_order`) : un seul historique atelier par client.
 *
 * - Référence `FI2411-0216` conservée ; un brouillon garde son `(PROV210)`.
 * - Machine : la description de la fiche ; le n° d'étiquette atelier
 *   (`N°ETIQ(36);`) passe dans `workshop_label`.
 * - Travaux : les lignes de la fiche, datées, avec leur durée.
 * - Dolibarr ne sert plus aux interventions depuis 11/2024 : une fiche validée
 *   ou facturée est « machine restituée », un brouillon « annulé ». L'état
 *   Dolibarr reste dans la note interne.
 * - La facture et le devis liés (`llx_element_element`) sont rattachés.
 *
 * À lancer après `customers`, `invoices` et `quotes`. Idempotent par
 * `repair_order.legacy_doli_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { isoDay } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { htmlLines } from '../lines.ts';

interface SourceIntervention {
	rowid: number;
	ref: string;
	fk_soc: number;
	fk_statut: number;
	description: string | null;
	note_public: string | null;
	note_private: string | null;
	datec: Date;
	date_valid: Date | null;
}

interface SourceWork {
	fk_fichinter: number;
	description: string | null;
	date: Date | null;
	duree: number | null;
}

interface SourceLink {
	fichinter: number;
	targettype: string;
	target: number;
}

const DOLI_STATUS: Record<number, string> = {
	0: 'brouillon',
	1: 'validée',
	2: 'facturée',
	3: 'clôturée'
};

/** « N°ETIQ(36); » : n° de l'étiquette posée sur la machine. */
const LABEL = /N°\s*ETIQ\((\d+)\);?/i;

const duration = (seconds: number | null) => {
	const minutes = Math.round(Number(seconds ?? 0) / 60);
	if (!minutes) return null;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
};

export const interventionsTask: Task = {
	name: 'interventions',
	description: 'Fiches d’intervention (llx_fichinter → repair_order)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const interventions = await sourceQuery<SourceIntervention>(
			`SELECT rowid, ref, fk_soc, fk_statut, description, note_public, note_private, datec,
			        date_valid
			 FROM ${DOLI}.llx_fichinter ORDER BY rowid`
		);
		const works = await sourceQuery<SourceWork>(
			`SELECT fk_fichinter, description, date, duree
			 FROM ${DOLI}.llx_fichinterdet ORDER BY fk_fichinter, rang, rowid`
		);
		const links = await sourceQuery<SourceLink>(
			`SELECT fk_source AS fichinter, targettype, fk_target AS target
			 FROM ${DOLI}.llx_element_element
			 WHERE sourcetype = 'fichinter' AND targettype IN ('facture', 'propal')`
		);
		log.muted(
			`${count(interventions.length)} fiches, ${count(works.length)} lignes de travaux, ${count(links.length)} liens vers une facture ou un devis`
		);

		const sql = targetDb();
		const [customers, invoices, quotes] = await Promise.all([
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM customer WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM counter_invoice WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM quote WHERE legacy_doli_id IS NOT NULL`
		]);
		const customerOf = new Map(customers.map((c) => [Number(c.doli), c.id]));
		const invoiceOf = new Map(invoices.map((i) => [Number(i.doli), i.id]));
		const quoteOf = new Map(quotes.map((q) => [Number(q.doli), q.id]));
		const quoteLink = new Map(
			links
				.filter((l) => l.targettype === 'propal' && quoteOf.has(Number(l.target)))
				.map((l) => [Number(l.fichinter), quoteOf.get(Number(l.target))!])
		);

		const rows = interventions
			.filter((i) => customerOf.has(Number(i.fk_soc)))
			.map((i) => {
				const description = htmlLines(i.description);
				const label = LABEL.exec(description)?.[1] ?? null;
				const machine = description.replace(LABEL, '').trim();
				const work = works
					.filter((w) => Number(w.fk_fichinter) === Number(i.rowid))
					.map((w) =>
						[
							isoDay(w.date)?.split('-').reverse().join('/'),
							duration(w.duree),
							htmlLines(w.description)
						]
							.filter(Boolean)
							.join(' · ')
					)
					.join('\n');
				const status = Number(i.fk_statut);
				const done = i.date_valid ? new Date(i.date_valid).toISOString() : null;
				return {
					legacy_doli_id: Number(i.rowid),
					reference: i.ref,
					customer_id: customerOf.get(Number(i.fk_soc)),
					quote_id: quoteLink.get(Number(i.rowid)) ?? null,
					status: status === 0 ? 'cancelled' : 'delivered',
					machine_model: machine.split('\n')[0]?.slice(0, 200) || null,
					workshop_label: label,
					work_description:
						[machine.split('\n').slice(1).join('\n'), work].filter(Boolean).join('\n') || null,
					notes: htmlLines(i.note_public) || null,
					private_note: [
						`Fiche d'intervention Dolibarr ${i.ref} (${DOLI_STATUS[status] ?? status}).`,
						htmlLines(i.note_private)
					]
						.filter(Boolean)
						.join('\n'),
					created_at: new Date(i.datec).toISOString(),
					completed_at: status === 0 ? null : done,
					delivered_at: status === 0 ? null : done
				};
			});
		const orphans = interventions.length - rows.length;
		if (orphans) log.warn(`${count(orphans)} fiches sans client MSShop, ignorées`);
		if (dryRun) {
			log.warn(`Simulation : ${count(rows.length)} ordres de réparation auraient été repris.`);
			return { processed: 0, note: 'simulation' };
		}

		const invoiceLinks = links.filter(
			(l) => l.targettype === 'facture' && invoiceOf.has(Number(l.target))
		);
		await sql.begin(async (tx) => {
			const saved = await tx<{ id: number; legacy_doli_id: number }[]>`
				INSERT INTO repair_order (legacy_doli_id, reference, customer_id, quote_id, status,
					machine_model, workshop_label, work_description, notes, private_note, created_at,
					updated_at, completed_at, delivered_at)
				SELECT legacy_doli_id, reference, customer_id, quote_id, status, machine_model,
					workshop_label, work_description, notes, private_note, created_at, created_at,
					completed_at, delivered_at
				FROM jsonb_to_recordset(${tx.json(rows)}) AS r(legacy_doli_id int, reference text,
					customer_id int, quote_id int, status text, machine_model text, workshop_label text,
					work_description text, notes text, private_note text, created_at timestamptz,
					completed_at timestamptz, delivered_at timestamptz)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
					customer_id = excluded.customer_id, quote_id = excluded.quote_id,
					status = excluded.status, machine_model = excluded.machine_model,
					workshop_label = excluded.workshop_label,
					work_description = excluded.work_description, notes = excluded.notes,
					private_note = excluded.private_note, completed_at = excluded.completed_at,
					delivered_at = excluded.delivered_at, updated_at = now()
				RETURNING id, legacy_doli_id`;
			const orderOf = new Map(saved.map((s) => [Number(s.legacy_doli_id), s.id]));

			// La facture et le devis de l'intervention renvoient à l'ordre.
			const toInvoice = invoiceLinks
				.filter((l) => orderOf.has(Number(l.fichinter)))
				.map((l) => ({
					invoice: invoiceOf.get(Number(l.target)),
					repair: orderOf.get(Number(l.fichinter))
				}));
			await tx`
				UPDATE counter_invoice AS c SET repair_order_id = l.repair
				FROM jsonb_to_recordset(${tx.json(toInvoice)}) AS l(invoice int, repair int)
				WHERE c.id = l.invoice AND c.repair_order_id IS NULL`;
			const toQuote = [...quoteLink.entries()]
				.filter(([fi]) => orderOf.has(fi))
				.map(([fi, quote]) => ({ quote, repair: orderOf.get(fi) }));
			await tx`
				UPDATE quote AS q SET repair_order_id = l.repair
				FROM jsonb_to_recordset(${tx.json(toQuote)}) AS l(quote int, repair int)
				WHERE q.id = l.quote AND q.repair_order_id IS NULL`;
		});
		return { processed: rows.length, note: `${count(rows.length)} ordres de réparation` };
	}
};

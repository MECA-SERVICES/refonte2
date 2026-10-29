/**
 * Bordereaux de remise de chèques Dolibarr (`llx_bordereau_cheque`) →
 * `remittance`, et leurs chèques rangés dessus (`settlement.remittance_id`).
 *
 * Un chèque remis est une écriture bancaire (`llx_bank.fk_bordereau`) liée à
 * un paiement (`llx_paiement.fk_bank`), déjà repris par la tâche `invoices`
 * (un règlement MSShop par facture payée). Total et nombre de chèques sont
 * ceux du bordereau imprimé.
 *
 * Numérotation : le bordereau garde son numéro (`CHK2610-0090`) et prend ce
 * numéro pour id, puisque MSShop numérote ses bordereaux par leur id
 * (`buildRemittanceReference`). La série continue donc : le prochain bordereau
 * MSShop sera le `…-0091`.
 *
 * À lancer après `invoices`. Idempotent par `remittance.legacy_doli_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { isoDay, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

interface SourceRemittance {
	rowid: number;
	ref: string;
	date_bordereau: Date | null;
	datec: Date;
	amount: number;
	nbcheque: number;
	account: string | null;
	author: string | null;
}

interface SourceCheque {
	/** `llx_paiement_facture.rowid` : clé des règlements repris. */
	rowid: number;
	fk_bordereau: number;
}

export const remittancesTask: Task = {
	name: 'remittances',
	description: 'Bordereaux de remise de chèques (llx_bordereau_cheque → remittance)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const remittances = await sourceQuery<SourceRemittance>(
			`SELECT r.rowid, r.ref, r.date_bordereau, r.datec, r.amount, r.nbcheque,
			        a.ref AS account, u.login AS author
			 FROM ${DOLI}.llx_bordereau_cheque r
			 LEFT JOIN ${DOLI}.llx_bank_account a ON a.rowid = r.fk_bank_account
			 LEFT JOIN ${DOLI}.llx_user u ON u.rowid = r.fk_user_author
			 WHERE r.statut = 1
			 ORDER BY r.rowid`
		);
		const cheques = await sourceQuery<SourceCheque>(
			`SELECT pf.rowid, b.fk_bordereau
			 FROM ${DOLI}.llx_paiement_facture pf
			 JOIN ${DOLI}.llx_paiement p ON p.rowid = pf.fk_paiement
			 JOIN ${DOLI}.llx_bank b ON b.rowid = p.fk_bank
			 WHERE b.fk_bordereau > 0`
		);
		log.muted(
			`${count(remittances.length)} bordereaux validés, ${count(cheques.length)} règlements remis en source`
		);

		// Le numéro du bordereau devient son id : il doit être lisible et unique.
		const rows = remittances.map((r) => ({
			id: Number(/-(\d+)$/.exec(r.ref)?.[1]),
			legacy_doli_id: Number(r.rowid),
			reference: r.ref,
			bank_account: text(r.account) ?? 'COMPTE-PRO',
			deposited_on: isoDay(r.date_bordereau ?? r.datec),
			total: Number(r.amount).toFixed(2),
			settlement_count: Number(r.nbcheque),
			created_by: r.author ? `Dolibarr (${r.author})` : 'Dolibarr',
			created_at: new Date(r.datec).toISOString()
		}));
		const ids = rows.map((r) => r.id);
		if (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
			throw new Error('Numéros de bordereau Dolibarr illisibles ou en double : reprise arrêtée.');
		}

		const sql = targetDb();
		const taken = await sql<{ id: number; reference: string }[]>`
			SELECT id, reference FROM remittance
			WHERE legacy_doli_id IS NULL AND (id = ANY(${ids}) OR reference = ANY(${rows.map((r) => r.reference)}))`;
		if (taken.length) {
			throw new Error(
				`Bordereaux MSShop déjà créés sur les numéros Dolibarr (${taken.map((t) => t.reference).join(', ')}) : reprise arrêtée.`
			);
		}

		if (dryRun) {
			log.warn(`Simulation : ${count(rows.length)} bordereaux auraient été repris.`);
			return { processed: 0, note: 'simulation' };
		}

		const mismatches = await sql.begin(async (tx) => {
			await tx`
				INSERT INTO remittance (id, legacy_doli_id, reference, kind, bank_account, deposited_on,
					total, settlement_count, created_by, created_at)
				SELECT id, legacy_doli_id, reference, 'cheque', bank_account, deposited_on, total,
					settlement_count, created_by, created_at
				FROM jsonb_to_recordset(${tx.json(rows)}) AS r(id int, legacy_doli_id int, reference text,
					bank_account text, deposited_on date, total numeric, settlement_count int,
					created_by text, created_at timestamptz)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
					reference = excluded.reference, bank_account = excluded.bank_account,
					deposited_on = excluded.deposited_on, total = excluded.total,
					settlement_count = excluded.settlement_count`;

			const links = cheques.map((c) => ({
				settlement: Number(c.rowid),
				remittance: Number(c.fk_bordereau)
			}));
			await tx`
				UPDATE settlement AS s SET remittance_id = r.id
				FROM jsonb_to_recordset(${tx.json(links)}) AS l(settlement int, remittance int)
				JOIN remittance r ON r.legacy_doli_id = l.remittance
				WHERE s.legacy_doli_id = l.settlement`;

			// La série continue après le dernier numéro Dolibarr (et jamais en arrière).
			await tx`
				SELECT setval(pg_get_serial_sequence('remittance', 'id'),
					greatest((SELECT max(id) FROM remittance), 1))`;

			// Contrôle : chaque bordereau porte bien le total imprimé.
			return tx<{ reference: string; total: string; sum: string }[]>`
				SELECT r.reference, r.total::text, coalesce(sum(s.amount), 0)::text AS sum
				FROM remittance r LEFT JOIN settlement s ON s.remittance_id = r.id
				WHERE r.legacy_doli_id IS NOT NULL
				GROUP BY r.id HAVING coalesce(sum(s.amount), 0) <> r.total`;
		});
		if (mismatches.length) {
			log.warn(
				`${count(mismatches.length)} bordereaux dont les chèques ne font pas le total : ${mismatches
					.slice(0, 5)
					.map((m) => `${m.reference} (${m.sum} / ${m.total})`)
					.join(', ')}`
			);
		}

		return {
			processed: rows.length,
			note: `${count(rows.length)} bordereaux, ${count(cheques.length)} règlements rangés`
		};
	}
};

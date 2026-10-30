/**
 * Crédits des clients : les « remises » Dolibarr (`llx_societe_remise_except`)
 * → `customer_credit`. Acompte, avoir ou trop-perçu converti en crédit, reprise
 * de machine, remise commerciale. Un crédit utilisé garde la facture où il a
 * servi (`used_invoice_id`) : en ligne négative (`fk_facture_line`) ou en
 * règlement (`fk_facture`). Les autres restent disponibles dans MSShop.
 *
 * À lancer après `customers` et `invoices`. Idempotent par
 * `customer_credit.legacy_doli_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count } from '../../../lib/logger.ts';
import { htmlLines } from '../lines.ts';

interface SourceCredit {
	rowid: number;
	fk_soc: number;
	datec: Date;
	amount_ht: number;
	amount_tva: number;
	amount_ttc: number;
	tva_tx: number;
	description: string | null;
	fk_facture_source: number | null;
	source_ref: string | null;
	fk_facture: number | null;
	line_invoice: number | null;
	fk_facture_line: number | null;
}

/** Origines nommées par Dolibarr dans la description. */
const ORIGINS: Record<string, string> = {
	'(DEPOSIT)': 'Acompte',
	'(CREDIT_NOTE)': 'Avoir',
	'(EXCESS RECEIVED)': 'Trop-perçu'
};

export const creditsTask: Task = {
	name: 'credits',
	description: 'Crédits des clients (llx_societe_remise_except → customer_credit)',

	async run({ dryRun }) {
		const credits = await sourceQuery<SourceCredit>(
			`SELECT r.rowid, r.fk_soc, r.datec, r.amount_ht, r.amount_tva, r.amount_ttc, r.tva_tx,
			        r.description, r.fk_facture_source, s.ref AS source_ref, r.fk_facture,
			        d.fk_facture AS line_invoice, r.fk_facture_line
			 FROM ${DOLI}.llx_societe_remise_except r
			 LEFT JOIN ${DOLI}.llx_facture s ON s.rowid = r.fk_facture_source
			 LEFT JOIN ${DOLI}.llx_facturedet d ON d.rowid = r.fk_facture_line
			 WHERE r.discount_type = 0
			 ORDER BY r.rowid`
		);
		const available = credits.filter((c) => !c.fk_facture && !c.fk_facture_line);
		log.muted(
			`${count(credits.length)} crédits en source, dont ${count(available.length)} disponibles (${available
				.reduce((sum, c) => sum + Number(c.amount_ttc), 0)
				.toFixed(2)} € TTC)`
		);

		const sql = targetDb();
		const [customers, invoices, lines] = await Promise.all([
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM customer WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM counter_invoice WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM counter_invoice_line
				WHERE legacy_doli_id IS NOT NULL`
		]);
		const customerOf = new Map(customers.map((c) => [Number(c.doli), c.id]));
		const invoiceOf = new Map(invoices.map((i) => [Number(i.doli), i.id]));
		const lineOf = new Map(lines.map((l) => [Number(l.doli), l.id]));

		const rows = credits
			.filter((c) => customerOf.has(Number(c.fk_soc)))
			.map((c) => {
				const raw = htmlLines(c.description);
				const origin = ORIGINS[raw.trim()];
				const usedOn = c.fk_facture ?? c.line_invoice;
				return {
					legacy_doli_id: Number(c.rowid),
					customer_id: customerOf.get(Number(c.fk_soc)),
					description: origin
						? `${origin}${c.source_ref ? ` ${c.source_ref}` : ''}`
						: raw || 'Crédit',
					amount_ht: Number(c.amount_ht).toFixed(2),
					amount_tva: Number(c.amount_tva).toFixed(2),
					amount_ttc: Number(c.amount_ttc).toFixed(2),
					tax_rate: String(c.tva_tx),
					source_invoice_id: c.fk_facture_source
						? (invoiceOf.get(Number(c.fk_facture_source)) ?? null)
						: null,
					used_invoice_id: usedOn ? (invoiceOf.get(Number(usedOn)) ?? null) : null,
					used_line_id: c.fk_facture_line ? (lineOf.get(Number(c.fk_facture_line)) ?? null) : null,
					created_at: new Date(c.datec).toISOString()
				};
			});
		const lost = credits.length - rows.length;
		if (lost)
			log.warn(`${count(lost)} crédits sans client MSShop : lancer d'abord --only=customers`);
		if (dryRun) {
			log.warn(`Simulation : ${count(rows.length)} crédits auraient été repris.`);
			return { processed: 0, note: 'simulation' };
		}

		await sql`
			INSERT INTO customer_credit (legacy_doli_id, customer_id, description, amount_ht, amount_tva,
				amount_ttc, tax_rate, source_invoice_id, used_invoice_id, used_line_id, created_at)
			SELECT legacy_doli_id, customer_id, description, amount_ht, amount_tva, amount_ttc, tax_rate,
				source_invoice_id, used_invoice_id, used_line_id, created_at
			FROM jsonb_to_recordset(${sql.json(rows)}) AS c(legacy_doli_id int, customer_id int,
				description text, amount_ht numeric, amount_tva numeric, amount_ttc numeric,
				tax_rate numeric, source_invoice_id int, used_invoice_id int, used_line_id int,
				created_at timestamptz)
			ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
				customer_id = excluded.customer_id, description = excluded.description,
				amount_ht = excluded.amount_ht, amount_tva = excluded.amount_tva,
				amount_ttc = excluded.amount_ttc, tax_rate = excluded.tax_rate,
				source_invoice_id = excluded.source_invoice_id,
				used_invoice_id = excluded.used_invoice_id, used_line_id = excluded.used_line_id`;
		return { processed: rows.length, note: `${count(rows.length)} crédits` };
	}
};

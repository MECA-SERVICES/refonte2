/**
 * Factures Dolibarr → `counter_invoice`, `counter_invoice_line`, `settlement`.
 *
 * - `llx_facture` : factures (type 0), avoirs (2), acomptes (3) ; statut
 *   brouillon (0), validée (1), payée (2), abandonnée (3). Les numéros
 *   (`FA2610-1315`) sont repris tels quels ; un brouillon (`(PROV1003)`) n'en a pas.
 *   Avec la réf. client, les conditions et le mode de règlement, l'échéance et
 *   le compte bancaire ;
 * - `llx_facturedet` : lignes (produit, prestation ou ligne libre), remise,
 *   TVA, totaux tels qu'imprimés ;
 * - `llx_paiement` + `llx_paiement_facture` : règlements (chèque, virement,
 *   espèces), avec l'émetteur et la banque du chèque (`llx_bank`). Ils sont
 *   déjà en banque : la tâche `remittances` les range sur leur bordereau.
 *
 * Enfin, les séquences de numérotation repartent après le dernier numéro
 * Dolibarr : la série continue dans MSShop (`FA2611-1316`…).
 *
 * À lancer après `customers` et `products`. Idempotent : factures et
 * règlements repris sont mis à jour, les lignes remplacées.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { htmlText as plain, isoDay as day, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { lineText } from '../lines.ts';

interface SourceInvoice {
	rowid: number;
	ref: string;
	type: number;
	fk_statut: number;
	fk_soc: number;
	fk_facture_source: number | null;
	datef: Date | null;
	date_valid: Date | null;
	total: number;
	tva: number;
	total_ttc: number;
	note_public: string | null;
	note_private: string | null;
	close_note: string | null;
	ref_client: string | null;
	terms: string | null;
	date_lim_reglement: Date | null;
	mode: string | null;
	account: string | null;
}

interface SourceLine {
	rowid: number;
	fk_facture: number;
	fk_product: number | null;
	product_ref: string | null;
	product_label: string | null;
	label: string | null;
	description: string | null;
	qty: number;
	subprice: number;
	tva_tx: number;
	remise_percent: number;
	total_ht: number;
	total_tva: number;
	total_ttc: number;
	rang: number;
	accountancy_code_sell: string | null;
}

interface SourcePayment {
	rowid: number;
	fk_facture: number;
	amount: number;
	ref: string;
	datep: Date;
	num_paiement: string | null;
	issuer: string | null;
	bank: string | null;
	mode: string | null;
	account: string | null;
}

const KINDS: Record<number, string> = { 0: 'invoice', 2: 'credit_note', 3: 'deposit' };
const STATUSES: Record<number, string> = { 0: 'draft', 1: 'validated', 2: 'paid', 3: 'abandoned' };
/** Conditions de règlement (`llx_c_payment_term.code`) → `$lib/counter-invoices`. */
const TERMS: Record<string, string> = {
	RECEP: 'receipt',
	'14D': '14d',
	'30D': '30d',
	'30DENDMONTH': '30d_end_month'
};
const METHODS: Record<string, string> = { CHQ: 'cheque', VIR: 'transfer', LIQ: 'cash', CB: 'card' };

export const invoicesTask: Task = {
	name: 'invoices',
	description: 'Factures, avoirs et règlements (llx_facture → counter_invoice)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const invoices = await sourceQuery<SourceInvoice>(
			`SELECT f.rowid, f.ref, f.type, f.fk_statut, f.fk_soc, f.fk_facture_source, f.datef,
			        f.date_valid, f.total, f.tva, f.total_ttc, f.note_public, f.note_private, f.close_note,
			        f.ref_client, t.code AS terms, f.date_lim_reglement, m.code AS mode, a.ref AS account
			 FROM ${DOLI}.llx_facture f
			 LEFT JOIN ${DOLI}.llx_c_payment_term t ON t.rowid = f.fk_cond_reglement
			 LEFT JOIN ${DOLI}.llx_c_paiement m ON m.id = f.fk_mode_reglement
			 LEFT JOIN ${DOLI}.llx_bank_account a ON a.rowid = f.fk_account
			 ORDER BY f.rowid`
		);
		const lines = await sourceQuery<SourceLine>(
			`SELECT d.rowid, d.fk_facture, d.fk_product, p.ref AS product_ref, p.label AS product_label,
			        d.label, d.description, d.qty, d.subprice, d.tva_tx, d.remise_percent, d.total_ht,
			        d.total_tva, d.total_ttc, d.rang, p.accountancy_code_sell
			 FROM ${DOLI}.llx_facturedet d LEFT JOIN ${DOLI}.llx_product p ON p.rowid = d.fk_product`
		);
		const payments = await sourceQuery<SourcePayment>(
			`SELECT pf.rowid, pf.fk_facture, pf.amount, p.ref, p.datep,
			        coalesce(nullif(b.num_chq, ''), p.num_paiement) AS num_paiement,
			        b.emetteur AS issuer, b.banque AS bank, c.code AS mode, a.ref AS account
			 FROM ${DOLI}.llx_paiement_facture pf
			 JOIN ${DOLI}.llx_paiement p ON p.rowid = pf.fk_paiement
			 LEFT JOIN ${DOLI}.llx_bank b ON b.rowid = p.fk_bank
			 LEFT JOIN ${DOLI}.llx_bank_account a ON a.rowid = b.fk_account
			 LEFT JOIN ${DOLI}.llx_c_paiement c ON c.id = p.fk_paiement`
		);
		log.muted(
			`${count(invoices.length)} factures, ${count(lines.length)} lignes, ${count(payments.length)} règlements en source`
		);

		const sql = targetDb();
		const [customers, products] = await Promise.all([
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM customer WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM product WHERE legacy_doli_id IS NOT NULL`
		]);
		const customerOf = new Map(customers.map((c) => [Number(c.doli), c.id]));
		const productOf = new Map(products.map((p) => [Number(p.doli), p.id]));
		const orphans = invoices.filter((i) => !customerOf.has(Number(i.fk_soc)));
		if (orphans.length) {
			log.warn(
				`${count(orphans.length)} factures sans client MSShop : lancer d'abord --only=customers`
			);
		}

		if (dryRun) {
			log.warn(
				`Simulation : ${count(invoices.length - orphans.length)} factures auraient été reprises.`
			);
			return { processed: 0, note: 'simulation' };
		}

		const kept = invoices.filter((i) => customerOf.has(Number(i.fk_soc)));
		await sql.begin(async (tx) => {
			const header = kept.map((i) => {
				const breakdown = new Map<number, { rate: number; baseHt: number; taxAmount: number }>();
				for (const l of lines.filter((l) => Number(l.fk_facture) === Number(i.rowid))) {
					const rate = Number(l.tva_tx);
					const row = breakdown.get(rate) ?? { rate, baseHt: 0, taxAmount: 0 };
					row.baseHt = Math.round((row.baseHt + Number(l.total_ht)) * 100) / 100;
					row.taxAmount = Math.round((row.taxAmount + Number(l.total_tva)) * 100) / 100;
					breakdown.set(rate, row);
				}
				return {
					legacy_doli_id: Number(i.rowid),
					kind: KINDS[Number(i.type)] ?? 'invoice',
					number: /^\(PROV/.test(i.ref) ? null : i.ref,
					status: STATUSES[Number(i.fk_statut)] ?? 'validated',
					customer_id: customerOf.get(Number(i.fk_soc)),
					issued_on: day(i.datef),
					customer_reference: text(i.ref_client),
					payment_terms: TERMS[i.terms ?? ''] ?? 'receipt',
					due_on: i.date_lim_reglement ? day(i.date_lim_reglement) : null,
					payment_method: METHODS[i.mode ?? ''] ?? null,
					bank_account: text(i.account) ?? 'COMPTE-PRO',
					total_ht: Number(i.total).toFixed(2),
					total_tva: Number(i.tva).toFixed(2),
					total_ttc: Number(i.total_ttc).toFixed(2),
					tax_breakdown: [...breakdown.values()],
					note: text(plain(i.note_public)),
					private_note: text(plain(i.note_private)),
					abandon_reason:
						Number(i.fk_statut) === 3 ? (text(i.close_note) ?? 'Abandonnée dans Dolibarr') : null,
					validated_at: i.date_valid ? new Date(i.date_valid).toISOString() : null,
					created_at: (i.datef ? new Date(i.datef) : new Date()).toISOString()
				};
			});
			const saved = await tx<{ id: number; legacy_doli_id: number }[]>`
				INSERT INTO counter_invoice (legacy_doli_id, kind, number, status, customer_id, issued_on,
					customer_reference, payment_terms, due_on, payment_method, bank_account,
					total_ht, total_tva, total_ttc, tax_breakdown, note, private_note, abandon_reason,
					validated_at, created_at)
				SELECT legacy_doli_id, kind, number, status, customer_id, issued_on, customer_reference,
					payment_terms, due_on, payment_method, bank_account, total_ht, total_tva,
					total_ttc, tax_breakdown, note, private_note, abandon_reason, validated_at, created_at
				FROM jsonb_to_recordset(${tx.json(header)}) AS i(legacy_doli_id int, kind text, number text,
					status text, customer_id int, issued_on date, customer_reference text,
					payment_terms text, due_on date, payment_method text, bank_account text,
					total_ht numeric, total_tva numeric,
					total_ttc numeric, tax_breakdown jsonb, note text, private_note text, abandon_reason text,
					validated_at timestamptz, created_at timestamptz)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
					number = excluded.number, status = excluded.status, issued_on = excluded.issued_on,
					customer_reference = excluded.customer_reference,
					payment_terms = excluded.payment_terms, due_on = excluded.due_on,
					payment_method = excluded.payment_method, bank_account = excluded.bank_account,
					total_ht = excluded.total_ht, total_tva = excluded.total_tva,
					total_ttc = excluded.total_ttc, tax_breakdown = excluded.tax_breakdown,
					note = excluded.note, private_note = excluded.private_note,
					abandon_reason = excluded.abandon_reason, validated_at = excluded.validated_at,
					updated_at = now()
				RETURNING id, legacy_doli_id`;
			const invoiceOf = new Map(saved.map((s) => [Number(s.legacy_doli_id), s.id]));

			// Avoirs : la facture qu'ils corrigent.
			const credits = kept
				.filter((i) => i.fk_facture_source && invoiceOf.has(Number(i.fk_facture_source)))
				.map((i) => ({
					id: invoiceOf.get(Number(i.rowid)),
					source: invoiceOf.get(Number(i.fk_facture_source))
				}));
			await tx`
				UPDATE counter_invoice AS c SET credited_invoice_id = l.source
				FROM jsonb_to_recordset(${tx.json(credits)}) AS l(id int, source int)
				WHERE c.id = l.id`;

			// Lignes : remplacées d'un bloc.
			await tx`DELETE FROM counter_invoice_line WHERE invoice_id = ANY(${[...invoiceOf.values()]})`;
			const lineRows = lines
				.filter((l) => invoiceOf.has(Number(l.fk_facture)))
				.map((l) => ({
					...lineText(l),
					legacy_doli_id: Number(l.rowid),
					invoice_id: invoiceOf.get(Number(l.fk_facture)),
					position: Number(l.rang) || 0,
					product_id: l.fk_product ? (productOf.get(Number(l.fk_product)) ?? null) : null,
					reference: text(l.product_ref),
					quantity: String(l.qty),
					unit_price_ht: Number(l.subprice).toFixed(4),
					tax_rate: String(l.tva_tx),
					discount_percent: String(l.remise_percent ?? 0),
					total_ht: Number(l.total_ht).toFixed(2),
					total_tva: Number(l.total_tva).toFixed(2),
					total_ttc: Number(l.total_ttc).toFixed(2),
					accounting_code: text(l.accountancy_code_sell)
				}));
			for (let i = 0; i < lineRows.length; i += 2000) {
				await tx`
					INSERT INTO counter_invoice_line (legacy_doli_id, invoice_id, position, product_id, label,
						description, reference, quantity, unit_price_ht, tax_rate, discount_percent, total_ht, total_tva,
						total_ttc, accounting_code)
					SELECT legacy_doli_id, invoice_id, position, product_id, label, description, reference, quantity,
						unit_price_ht, tax_rate, discount_percent, total_ht, total_tva, total_ttc, accounting_code
					FROM jsonb_to_recordset(${tx.json(lineRows.slice(i, i + 2000))}) AS l(legacy_doli_id int,
						invoice_id int, position int, product_id int, label text, description text, reference text,
						quantity numeric, unit_price_ht numeric, tax_rate numeric, discount_percent numeric,
						total_ht numeric, total_tva numeric, total_ttc numeric, accounting_code text)`;
			}

			// Règlements : déjà en banque dans Dolibarr, jamais en caisse.
			const settlementRows = payments
				.filter((p) => invoiceOf.has(Number(p.fk_facture)) && Number(p.amount) !== 0)
				.map((p) => {
					const method = METHODS[p.mode ?? ''] ?? 'transfer';
					return {
						legacy_doli_id: Number(p.rowid),
						reference: `DOLI-${p.ref}-${p.rowid}`,
						method,
						amount: Number(p.amount).toFixed(2),
						received_on: day(p.datep),
						cheque_number: method === 'cheque' ? text(p.num_paiement) : null,
						cheque_issuer: method === 'cheque' ? text(p.issuer) : null,
						cheque_bank: method === 'cheque' ? text(p.bank) : null,
						bank_account: text(p.account),
						counter_invoice_id: invoiceOf.get(Number(p.fk_facture))
					};
				});
			await tx`
				INSERT INTO settlement (legacy_doli_id, reference, method, amount, received_on,
					cheque_number, cheque_issuer, cheque_bank, bank_account, counter_invoice_id)
				SELECT legacy_doli_id, reference, method, amount, received_on, cheque_number, cheque_issuer,
					cheque_bank, bank_account, counter_invoice_id
				FROM jsonb_to_recordset(${tx.json(settlementRows)}) AS s(legacy_doli_id int, reference text,
					method text, amount numeric, received_on date, cheque_number text, cheque_issuer text,
					cheque_bank text, bank_account text, counter_invoice_id int)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
					amount = excluded.amount, received_on = excluded.received_on, method = excluded.method,
					cheque_number = excluded.cheque_number, cheque_issuer = excluded.cheque_issuer,
					cheque_bank = excluded.cheque_bank, bank_account = excluded.bank_account`;

			// La série continue après le dernier numéro Dolibarr (et jamais en arrière).
			for (const [seq, prefix] of [
				['counter_invoice_number_seq', 'FA'],
				['counter_credit_note_number_seq', 'AV']
			] as const) {
				await tx.unsafe(
					`SELECT setval('${seq}', greatest(
						(SELECT last_value FROM ${seq}) - 1,
						coalesce((SELECT max(substring(number from '-(\\d+)$')::int) FROM counter_invoice
						          WHERE number LIKE '${prefix}%'), 0)
					), true)`
				);
			}
		});

		return {
			processed: kept.length,
			note: `${count(kept.length)} factures, ${count(payments.length)} règlements`
		};
	}
};

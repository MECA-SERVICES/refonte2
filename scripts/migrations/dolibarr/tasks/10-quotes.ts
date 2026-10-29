/**
 * Devis Dolibarr → `quote`, `quote_line`.
 *
 * - `llx_propal` : statut brouillon (0), validé (1, envoyé), signé (2,
 *   accepté), non signé (3, refusé), facturé (4). Les numéros (`PR2610-0321`)
 *   sont repris tels quels ; un brouillon (`(PROV106)`) n'en a pas. La date
 *   limite (`fin_validite`) est reprise, la durée en est déduite ;
 * - `llx_propaldet` : lignes, rattachées au produit MSShop quand il existe ;
 *   sinon ligne libre qui garde sa référence ;
 * - `llx_element_element` (propal → facture) : la facture comptoir issue du
 *   devis. Un devis facturé en plusieurs fois garde sa première facture.
 *
 * La série continue ensuite dans MSShop (`PR2611-0322`…).
 *
 * À lancer après `customers`, `products` et `invoices`. Idempotent : devis mis
 * à jour, lignes remplacées.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { htmlText as plain, isoDay, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

interface SourceQuote {
	rowid: number;
	ref: string;
	fk_soc: number;
	fk_statut: number;
	datep: Date | null;
	datec: Date;
	fin_validite: Date | null;
	date_valid: Date | null;
	date_cloture: Date | null;
	total_ht: number;
	tva: number;
	total: number;
	note_public: string | null;
	note_private: string | null;
}

interface SourceLine {
	rowid: number;
	fk_propal: number;
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

const STATUSES: Record<number, string> = {
	0: 'draft',
	1: 'sent',
	2: 'accepted',
	3: 'rejected',
	4: 'invoiced'
};

/** Jours entre deux dates `AAAA-MM-JJ`. */
const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const quotesTask: Task = {
	name: 'quotes',
	description: 'Devis et leurs lignes (llx_propal → quote)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const quotes = await sourceQuery<SourceQuote>(
			`SELECT rowid, ref, fk_soc, fk_statut, datep, datec, fin_validite, date_valid, date_cloture,
			        total_ht, tva, total, note_public, note_private
			 FROM ${DOLI}.llx_propal ORDER BY rowid`
		);
		const lines = await sourceQuery<SourceLine>(
			`SELECT d.rowid, d.fk_propal, d.fk_product, p.ref AS product_ref, p.label AS product_label,
			        d.label, d.description, d.qty, d.subprice, d.tva_tx, d.remise_percent, d.total_ht,
			        d.total_tva, d.total_ttc, d.rang, p.accountancy_code_sell
			 FROM ${DOLI}.llx_propaldet d LEFT JOIN ${DOLI}.llx_product p ON p.rowid = d.fk_product`
		);
		const links = await sourceQuery<{ quote: number; invoice: number }>(
			`SELECT fk_source AS quote, MIN(fk_target) AS invoice
			 FROM ${DOLI}.llx_element_element
			 WHERE sourcetype = 'propal' AND targettype = 'facture'
			 GROUP BY fk_source`
		);
		log.muted(
			`${count(quotes.length)} devis, ${count(lines.length)} lignes, ${count(links.length)} devis facturés en source`
		);

		const sql = targetDb();
		const [customers, products, invoices] = await Promise.all([
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM customer WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM product WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM counter_invoice WHERE legacy_doli_id IS NOT NULL`
		]);
		const customerOf = new Map(customers.map((c) => [Number(c.doli), c.id]));
		const productOf = new Map(products.map((p) => [Number(p.doli), p.id]));
		const invoiceOfDoli = new Map(invoices.map((i) => [Number(i.doli), i.id]));
		const invoiceOf = new Map(
			links.map((l) => [Number(l.quote), invoiceOfDoli.get(Number(l.invoice)) ?? null])
		);
		const kept = quotes.filter((q) => customerOf.has(Number(q.fk_soc)));
		if (kept.length < quotes.length) {
			log.warn(
				`${count(quotes.length - kept.length)} devis sans client MSShop : lancer d'abord --only=customers`
			);
		}
		const unlinked = lines.filter((l) => l.fk_product && !productOf.has(Number(l.fk_product)));
		log.muted(
			`${count(unlinked.length)} lignes d'un produit absent de MSShop : reprises en ligne libre, avec leur référence`
		);

		if (dryRun) {
			log.warn(`Simulation : ${count(kept.length)} devis auraient été repris.`);
			return { processed: 0, note: 'simulation' };
		}

		await sql.begin(async (tx) => {
			const header = kept.map((q) => {
				const breakdown = new Map<number, { rate: number; baseHt: number; taxAmount: number }>();
				for (const l of lines.filter((l) => Number(l.fk_propal) === Number(q.rowid))) {
					const rate = Number(l.tva_tx);
					const row = breakdown.get(rate) ?? { rate, baseHt: 0, taxAmount: 0 };
					row.baseHt = Math.round((row.baseHt + Number(l.total_ht)) * 100) / 100;
					row.taxAmount = Math.round((row.taxAmount + Number(l.total_tva)) * 100) / 100;
					breakdown.set(rate, row);
				}
				const issuedOn = isoDay(q.datep);
				const validUntil = isoDay(q.fin_validite);
				const invoiceId = invoiceOf.get(Number(q.rowid)) ?? null;
				const status = STATUSES[Number(q.fk_statut)] ?? 'sent';
				return {
					legacy_doli_id: Number(q.rowid),
					number: /^\(PROV/.test(q.ref) ? null : q.ref,
					// Un devis envoyé ou signé dont une facture est issue est facturé.
					status: invoiceId && (status === 'sent' || status === 'accepted') ? 'invoiced' : status,
					customer_id: customerOf.get(Number(q.fk_soc)),
					invoice_id: invoiceId,
					issued_on: issuedOn,
					validity_days:
						issuedOn && validUntil ? Math.max(1, daysBetween(issuedOn, validUntil)) : 15,
					valid_until: Number(q.fk_statut) === 0 ? null : validUntil,
					total_ht: Number(q.total_ht).toFixed(2),
					total_tva: Number(q.tva).toFixed(2),
					total_ttc: Number(q.total).toFixed(2),
					tax_breakdown: [...breakdown.values()],
					note: text(plain(q.note_public)),
					private_note: text(plain(q.note_private)),
					sent_at: q.date_valid ? new Date(q.date_valid).toISOString() : null,
					decided_at: q.date_cloture ? new Date(q.date_cloture).toISOString() : null,
					created_at: new Date(q.datec).toISOString()
				};
			});
			const saved = await tx<{ id: number; legacy_doli_id: number }[]>`
				INSERT INTO quote (legacy_doli_id, number, status, customer_id, invoice_id, issued_on,
					validity_days, valid_until, total_ht, total_tva, total_ttc, tax_breakdown, note,
					private_note, sent_at, decided_at, created_at)
				SELECT legacy_doli_id, number, status, customer_id, invoice_id, issued_on, validity_days,
					valid_until, total_ht, total_tva, total_ttc, tax_breakdown, note, private_note, sent_at,
					decided_at, created_at
				FROM jsonb_to_recordset(${tx.json(header)}) AS q(legacy_doli_id int, number text,
					status text, customer_id int, invoice_id int, issued_on date, validity_days int,
					valid_until date, total_ht numeric, total_tva numeric, total_ttc numeric,
					tax_breakdown jsonb, note text, private_note text, sent_at timestamptz,
					decided_at timestamptz, created_at timestamptz)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
					number = excluded.number, status = excluded.status, invoice_id = excluded.invoice_id,
					issued_on = excluded.issued_on, validity_days = excluded.validity_days,
					valid_until = excluded.valid_until, total_ht = excluded.total_ht,
					total_tva = excluded.total_tva, total_ttc = excluded.total_ttc,
					tax_breakdown = excluded.tax_breakdown, note = excluded.note,
					private_note = excluded.private_note, sent_at = excluded.sent_at,
					decided_at = excluded.decided_at, updated_at = now()
				RETURNING id, legacy_doli_id`;
			const quoteOf = new Map(saved.map((s) => [Number(s.legacy_doli_id), s.id]));

			// Lignes : remplacées d'un bloc.
			await tx`DELETE FROM quote_line WHERE quote_id = ANY(${[...quoteOf.values()]})`;
			const lineRows = lines
				.filter((l) => quoteOf.has(Number(l.fk_propal)))
				.map((l) => ({
					legacy_doli_id: Number(l.rowid),
					quote_id: quoteOf.get(Number(l.fk_propal)),
					position: Number(l.rang) || 0,
					product_id: l.fk_product ? (productOf.get(Number(l.fk_product)) ?? null) : null,
					label:
						text(plain(l.label)) ??
						text(plain(l.product_label)) ??
						text(plain(l.description))?.slice(0, 200) ??
						'Ligne',
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
					INSERT INTO quote_line (legacy_doli_id, quote_id, position, product_id, label, reference,
						quantity, unit_price_ht, tax_rate, discount_percent, total_ht, total_tva, total_ttc,
						accounting_code)
					SELECT legacy_doli_id, quote_id, position, product_id, label, reference, quantity,
						unit_price_ht, tax_rate, discount_percent, total_ht, total_tva, total_ttc, accounting_code
					FROM jsonb_to_recordset(${tx.json(lineRows.slice(i, i + 2000))}) AS l(legacy_doli_id int,
						quote_id int, position int, product_id int, label text, reference text,
						quantity numeric, unit_price_ht numeric, tax_rate numeric, discount_percent numeric,
						total_ht numeric, total_tva numeric, total_ttc numeric, accounting_code text)`;
			}

			// La série continue après le dernier numéro Dolibarr (et jamais en arrière).
			await tx`
				SELECT setval('quote_number_seq', greatest(
					(SELECT last_value FROM quote_number_seq) - 1,
					coalesce((SELECT max(substring(number from '-(\\d+)$')::int) FROM quote
					          WHERE number LIKE 'PR%'), 0)
				), true)`;
		});

		return { processed: kept.length, note: `${count(kept.length)} devis` };
	}
};

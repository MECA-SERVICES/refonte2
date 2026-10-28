/**
 * Historique des bons de stock du module Dolibarr « UTILE » → `stock_voucher`
 * et `stock_movement`.
 *
 * - `utile_bon_livraison` : réceptions fournisseur (n° de BL, fournisseur) ;
 * - `utile_bon_sortie` : sorties (n° de bon, motif Normal / Consommable /
 *   Investissement).
 * Les lignes d'un même bon partagent sa clé (`cle`, horodatage de saisie).
 *
 * C'est de l'historique : les mouvements repris ne touchent pas au stock
 * (déjà repris par `stock`) et n'ont pas d'emplacement, UTILE n'en gardant
 * pas. Les lignes de produits absents de MSShop sont comptées et laissées de
 * côté. Idempotent : bons et mouvements repris sont remplacés à chaque passe.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { conditionOf } from '../conditions.ts';

interface SourceLine {
	id: number;
	reference: string | null;
	extra: string | null;
	id_product: number;
	quantite: number;
	date: Date;
	cle: number;
	type: number | null;
	numero_serie: string | null;
}

/** Motif UTILE → motif MSShop. */
const REASONS: Record<string, string> = {
	Normal: 'normal',
	Consommable: 'consumable',
	Investissement: 'investment'
};

/** Lignes insérées par lots : 165 000 lignes dépassent une seule requête. */
const BATCH = 5000;

export const vouchersTask: Task = {
	name: 'vouchers',
	description: 'Historique des bons (utile_bon_livraison, utile_bon_sortie → stock_voucher)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const receipts = await sourceQuery<SourceLine>(
			`SELECT id, bl_fournisseur AS reference, marque AS extra, id_product, quantite, date, cle,
			        type, numero_serie
			 FROM ${DOLI}.utile_bon_livraison WHERE annule = 0 AND quantite <> 0`
		);
		const issues = await sourceQuery<SourceLine>(
			`SELECT id, bs AS reference, designation AS extra, id_product, quantite, date, cle,
			        type, numero_serie
			 FROM ${DOLI}.utile_bon_sortie WHERE annule = 0 AND quantite <> 0`
		);
		log.muted(
			`${count(receipts.length)} lignes d'entrée, ${count(issues.length)} lignes de sortie`
		);

		const sql = targetDb();
		const products = await sql<{ id: number; doli: number }[]>`
			SELECT id, legacy_doli_id AS doli FROM product WHERE legacy_doli_id IS NOT NULL`;
		const productOf = new Map(products.map((p) => [Number(p.doli), p.id]));

		type Voucher = {
			key: string;
			kind: 'receipt' | 'issue';
			reference: string | null;
			supplier: string | null;
			reason: string | null;
			created_at: string;
		};
		const vouchers = new Map<string, Voucher>();
		const movements: Record<string, unknown>[] = [];
		let skipped = 0;
		for (const [kind, rows] of [
			['receipt', receipts],
			['issue', issues]
		] as const) {
			for (const r of rows) {
				const productId = productOf.get(Number(r.id_product));
				if (!productId) {
					skipped++;
					continue;
				}
				const key = `${kind === 'receipt' ? 'bl' : 'bs'}:${r.cle}`;
				const createdAt = new Date(r.date).toISOString();
				if (!vouchers.has(key)) {
					vouchers.set(key, {
						key,
						kind,
						reference: text(r.reference),
						supplier: kind === 'receipt' ? text(r.extra) : null,
						reason: kind === 'issue' ? (REASONS[r.extra ?? ''] ?? 'normal') : null,
						created_at: createdAt
					});
				}
				const serial = (r.numero_serie ?? '').trim();
				const quantity = Math.abs(Math.round(Number(r.quantite)));
				movements.push({
					legacy_doli_id: `${kind === 'receipt' ? 'bl' : 'bs'}:${r.id}`,
					voucher_key: key,
					product_id: productId,
					type: kind === 'receipt' ? 'in' : 'out',
					quantity: kind === 'receipt' ? quantity : -quantity,
					condition: conditionOf(r.type === null ? null : Number(r.type)),
					serial_number: serial && serial !== '-1' ? serial : null,
					reference: text(r.reference),
					created_at: createdAt
				});
			}
		}
		log.muted(
			`${count(vouchers.size)} bons, ${count(movements.length)} mouvements ; ${count(skipped)} lignes de produits absents de MSShop ignorées`
		);

		if (dryRun) {
			log.warn('Simulation : aucun historique repris.');
			return { processed: 0, note: 'simulation' };
		}

		await sql.begin(async (tx) => {
			// Historique repris : remplacé d'un bloc à chaque passe.
			await tx`DELETE FROM stock_movement WHERE legacy_doli_id IS NOT NULL`;
			await tx`DELETE FROM stock_voucher WHERE legacy_doli_key IS NOT NULL`;
			const voucherRows = [...vouchers.values()];
			const voucherId = new Map<string, number>();
			for (let i = 0; i < voucherRows.length; i += BATCH) {
				const inserted = await tx<{ id: number; legacy_doli_key: string }[]>`
					INSERT INTO stock_voucher (kind, reference, supplier, reason, legacy_doli_key, created_at)
					SELECT kind, reference, supplier, reason, key, created_at
					FROM jsonb_to_recordset(${tx.json(voucherRows.slice(i, i + BATCH))}) AS v(
						key text, kind text, reference text, supplier text, reason text, created_at timestamptz)
					RETURNING id, legacy_doli_key`;
				for (const v of inserted) voucherId.set(v.legacy_doli_key, v.id);
			}
			const rows = movements.map(({ voucher_key, ...m }) => ({
				...m,
				voucher_id: voucherId.get(voucher_key as string)
			}));
			for (let i = 0; i < rows.length; i += BATCH) {
				await tx`
					INSERT INTO stock_movement (legacy_doli_id, voucher_id, product_id, type, quantity,
						condition, serial_number, reference, created_at)
					SELECT legacy_doli_id, voucher_id, product_id, type, quantity, condition, serial_number,
						reference, created_at
					FROM jsonb_to_recordset(${tx.json(rows.slice(i, i + BATCH))}) AS m(
						legacy_doli_id text, voucher_id int, product_id int, type text, quantity int,
						condition text, serial_number text, reference text, created_at timestamptz)`;
			}
		});
		return { processed: movements.length, note: `${count(vouchers.size)} bons` };
	}
};

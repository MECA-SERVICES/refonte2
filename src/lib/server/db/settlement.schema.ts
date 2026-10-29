/**
 * Règlements saisis en back-office (demande client 1.1).
 *
 * Encaissements au comptoir : chèque, espèces, carte, virement. Rattachés pour
 * l'instant aux ordres de réparation ; la colonne de rattachement aux
 * commandes viendra avec leur saisie. Les détails du chèque (numéro, émetteur,
 * banque) sont ceux qu'exige un bordereau de remise en banque.
 */
import { sql } from 'drizzle-orm';
import {
	date,
	index,
	integer,
	numeric,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { repairOrder } from './repair.schema';
import { counterInvoice } from './counter-invoice.schema';
import type { RemittanceKind, SettlementMethod } from '$lib/settlements';

/**
 * Bordereau de remise en banque (demande client 1.2) : chèques d'un côté,
 * espèces de l'autre, sur le modèle du bordereau Dolibarr `CHK2609-0089`.
 *
 * Créé validé : il décrit un dépôt déjà fait. Total et nombre de règlements
 * sont figés à la création, comme sur le document remis à la banque.
 */
export const remittance = pgTable(
	'remittance',
	{
		id: serial('id').primaryKey(),
		/** `CHK2610-0001` ou `ESP2610-0001` : voir `buildRemittanceReference`. */
		reference: text('reference').notNull(),
		kind: text('kind').$type<RemittanceKind>().notNull(),
		/** Compte crédité, tel que Davy le nomme (« COMPTE-PRO »). */
		bankAccount: text('bank_account').notNull(),
		depositedOn: date('deposited_on', { mode: 'string' }).notNull(),
		total: numeric('total', { precision: 12, scale: 2 }).notNull(),
		settlementCount: integer('settlement_count').notNull(),
		createdBy: text('created_by'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('remittance_reference_idx').on(t.reference)]
);

export const settlement = pgTable(
	'settlement',
	{
		id: serial('id').primaryKey(),
		/** `PAY2610-0042` : voir `buildSettlementReference`. */
		reference: text('reference').notNull(),
		method: text('method').$type<SettlementMethod>().notNull(),
		amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
		/** Date de réception du règlement, celle du bordereau. */
		receivedOn: date('received_on', { mode: 'string' }).notNull(),

		chequeNumber: text('cheque_number'),
		chequeIssuer: text('cheque_issuer'),
		chequeBank: text('cheque_bank'),

		/** Une pièce comptable ne disparaît pas avec l'ordre qu'elle règle. */
		repairOrderId: integer('repair_order_id').references(() => repairOrder.id, {
			onDelete: 'restrict'
		}),

		/** Facture comptoir réglée. */
		counterInvoiceId: integer('counter_invoice_id').references(() => counterInvoice.id, {
			onDelete: 'restrict'
		}),
		/** Reprise Dolibarr (`llx_paiement.rowid`) : déjà en banque, hors bordereau. */
		legacyDoliId: integer('legacy_doli_id'),

		/** Bordereau de remise qui l'a porté à la banque ; null tant qu'il est en caisse. */
		remittanceId: integer('remittance_id').references(() => remittance.id, {
			onDelete: 'set null'
		}),

		note: text('note'),
		/** Adresse de l'utilisateur back-office qui a saisi le règlement. */
		createdBy: text('created_by'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('settlement_reference_idx').on(t.reference),
		index('settlement_repair_order_idx').on(t.repairOrderId),
		index('settlement_method_received_idx').on(t.method, t.receivedOn),
		index('settlement_remittance_idx').on(t.remittanceId),
		index('settlement_counter_invoice_idx').on(t.counterInvoiceId),
		uniqueIndex('settlement_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type Remittance = typeof remittance.$inferSelect;
export type Settlement = typeof settlement.$inferSelect;
export type NewSettlement = typeof settlement.$inferInsert;

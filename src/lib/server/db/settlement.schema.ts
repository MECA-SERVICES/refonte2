/**
 * Règlements saisis en back-office (demande client 1.1).
 *
 * Encaissements au comptoir : chèque, espèces, carte, virement. Rattachés pour
 * l'instant aux ordres de réparation ; la colonne de rattachement aux
 * commandes viendra avec leur saisie. Les détails du chèque (numéro, émetteur,
 * banque) sont ceux qu'exige un bordereau de remise en banque.
 */
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
import type { SettlementMethod } from '$lib/settlements';

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

		note: text('note'),
		/** Adresse de l'utilisateur back-office qui a saisi le règlement. */
		createdBy: text('created_by'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('settlement_reference_idx').on(t.reference),
		index('settlement_repair_order_idx').on(t.repairOrderId),
		index('settlement_method_received_idx').on(t.method, t.receivedOn)
	]
);

export type Settlement = typeof settlement.$inferSelect;
export type NewSettlement = typeof settlement.$inferInsert;

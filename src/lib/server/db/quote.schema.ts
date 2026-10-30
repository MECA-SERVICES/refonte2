/**
 * Devis (CDC 23), repris de Dolibarr (`llx_propal`, `llx_propaldet`) : saisis
 * en back-office sur les clients et produits de MSShop.
 *
 * Un devis naît brouillon, sans numéro ; l'envoi lui donne le sien dans la
 * série Dolibarr (`PR2611-0322`), sa date limite de validité, et le fige
 * (R5 : un devis envoyé ne se modifie plus, on en émet un nouveau). Le client
 * l'accepte ou le refuse ; un devis accepté se transforme en facture comptoir.
 *
 * Les lignes ont la forme de celles des factures comptoir : mêmes calculs
 * (`$lib/counter-invoices`), même éditeur, même PDF.
 */
import { sql } from 'drizzle-orm';
import {
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { customer } from './customer.schema';
import { product } from './catalog.schema';
import { repairOrder } from './repair.schema';
import {
	counterInvoice,
	type CounterBillingAddress,
	type CounterTaxLine
} from './counter-invoice.schema';
import type { QuoteStatus } from '$lib/quotes';

export const quote = pgTable(
	'quote',
	{
		id: serial('id').primaryKey(),
		/** Numéro communiqué au client (R1), attribué à l'envoi ; null tant que brouillon. */
		number: text('number'),
		/** Statut enregistré ; « expiré » se déduit de la date limite (`quoteStatus`). */
		status: text('status').$type<QuoteStatus>().notNull().default('draft'),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		/** Ordre de réparation chiffré (R14), le cas échéant. */
		repairOrderId: integer('repair_order_id').references(() => repairOrder.id, {
			onDelete: 'set null'
		}),
		/** Facture comptoir issue du devis (R10, R11). */
		invoiceId: integer('invoice_id').references(() => counterInvoice.id, {
			onDelete: 'set null'
		}),
		/** Date d'émission (celle imprimée). */
		issuedOn: date('issued_on', { mode: 'string' }),
		/** Référence donnée par le client (chantier, machine), imprimée. */
		customerReference: text('customer_reference'),
		/** Date de livraison prévue, imprimée. */
		deliveryOn: date('delivery_on', { mode: 'string' }),
		validityDays: integer('validity_days').notNull().default(15),
		/** Date limite de validité, fixée à l'envoi (R3). */
		validUntil: date('valid_until', { mode: 'string' }),
		billingAddress: jsonb('billing_address').$type<CounterBillingAddress | null>(),
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
		taxBreakdown: jsonb('tax_breakdown').$type<CounterTaxLine[] | null>(),
		/** Note imprimée sur le devis. */
		note: text('note'),
		/** Note interne, jamais imprimée (R13). */
		privateNote: text('private_note'),
		/** Motif du refus, ou précision sur l'acceptation. */
		decisionNote: text('decision_note'),
		createdBy: text('created_by'),
		sentBy: text('sent_by'),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		decidedAt: timestamp('decided_at', { withTimezone: true }),
		/** Reprise Dolibarr : `llx_propal.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('quote_number_idx')
			.on(t.number)
			.where(sql`${t.number} IS NOT NULL`),
		index('quote_customer_idx').on(t.customerId),
		index('quote_status_idx').on(t.status),
		index('quote_invoice_idx').on(t.invoiceId),
		uniqueIndex('quote_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export const quoteLine = pgTable(
	'quote_line',
	{
		id: serial('id').primaryKey(),
		quoteId: integer('quote_id')
			.notNull()
			.references(() => quote.id, { onDelete: 'cascade' }),
		position: integer('position').notNull().default(0),
		/** Produit ou prestation du catalogue ; null pour une ligne libre (R6). */
		productId: integer('product_id').references(() => product.id, { onDelete: 'set null' }),
		label: text('label').notNull(),
		/** Détail imprimé sous la désignation : n° de série, garantie, caractéristiques. */
		description: text('description'),
		reference: text('reference'),
		quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull().default('1'),
		unitPriceHt: numeric('unit_price_ht', { precision: 12, scale: 4 }).notNull().default('0'),
		taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull().default('20'),
		discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
		accountingCode: text('accounting_code'),
		/** Reprise Dolibarr : `llx_propaldet.rowid`. */
		legacyDoliId: integer('legacy_doli_id')
	},
	(t) => [
		index('quote_line_quote_idx').on(t.quoteId),
		uniqueIndex('quote_line_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type Quote = typeof quote.$inferSelect;
export type QuoteLine = typeof quoteLine.$inferSelect;

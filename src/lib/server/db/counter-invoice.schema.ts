/**
 * Factures comptoir et avoirs, repris de Dolibarr (`llx_facture`,
 * `llx_facturedet`) : saisis en back-office, au comptoir ou depuis un ordre de
 * réparation, sur les produits et les clients de MSShop.
 *
 * Une facture naît brouillon, sans numéro ; la validation lui donne le sien
 * dans la série Dolibarr (`FA2611-1316`) et la fige : totaux, ventilation de
 * TVA, adresse. Une facture validée ne se modifie plus : on la corrige par un
 * avoir (`AV2611-0033`).
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
	uniqueIndex,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import type { PaymentTerms } from '$lib/counter-invoices';
import type { SettlementMethod } from '$lib/settlements';
import { customer } from './customer.schema';
import { product } from './catalog.schema';
import { repairOrder } from './repair.schema';

export const counterInvoiceKind = ['invoice', 'credit_note', 'deposit'] as const;
export type CounterInvoiceKind = (typeof counterInvoiceKind)[number];

/**
 * - `draft` : brouillon, modifiable, sans numéro ;
 * - `validated` : émise, en attente de règlement ;
 * - `paid` : réglée (ou soldée par avoir) ;
 * - `abandoned` : classée abandonnée, le reste dû ne sera pas encaissé.
 */
export const counterInvoiceStatus = ['draft', 'validated', 'paid', 'abandoned'] as const;
export type CounterInvoiceStatus = (typeof counterInvoiceStatus)[number];

/** Une ligne du détail des taxes, figée à la validation. */
export type CounterTaxLine = { rate: number; baseHt: number; taxAmount: number };

/** Adresse de facturation figée à la validation. */
export type CounterBillingAddress = {
	name: string;
	company?: string | null;
	line1?: string | null;
	line2?: string | null;
	postalCode?: string | null;
	city?: string | null;
	country?: string | null;
	phone?: string | null;
	email?: string | null;
	siret?: string | null;
	vatNumber?: string | null;
};

export const counterInvoice = pgTable(
	'counter_invoice',
	{
		id: serial('id').primaryKey(),
		kind: text('kind').$type<CounterInvoiceKind>().notNull().default('invoice'),
		/** Numéro légal, attribué à la validation ; null tant que brouillon. */
		number: text('number'),
		status: text('status').$type<CounterInvoiceStatus>().notNull().default('draft'),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		/** Ordre de réparation facturé, le cas échéant. */
		repairOrderId: integer('repair_order_id').references(() => repairOrder.id, {
			onDelete: 'set null'
		}),
		/** Avoir : la facture qu'il corrige. */
		creditedInvoiceId: integer('credited_invoice_id').references(
			(): AnyPgColumn => counterInvoice.id,
			{ onDelete: 'restrict' }
		),
		/** Date de facture (celle imprimée). */
		issuedOn: date('issued_on', { mode: 'string' }),
		/** Référence donnée par le client (n° de commande, chantier), imprimée. */
		customerReference: text('customer_reference'),
		paymentTerms: text('payment_terms').$type<PaymentTerms>().notNull().default('receipt'),
		/** Date limite de règlement, fixée à la validation. */
		dueOn: date('due_on', { mode: 'string' }),
		/** Mode de règlement prévu (chèque, virement…), imprimé. */
		paymentMethod: text('payment_method').$type<SettlementMethod>(),
		/** Compte crédité : `COMPTE-PRO` ou `CAISSE` (`$lib/settlements`). */
		bankAccount: text('bank_account').notNull().default('COMPTE-PRO'),
		billingAddress: jsonb('billing_address').$type<CounterBillingAddress | null>(),
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
		taxBreakdown: jsonb('tax_breakdown').$type<CounterTaxLine[] | null>(),
		/** Note imprimée sur la facture. */
		note: text('note'),
		/** Note interne, jamais imprimée. */
		privateNote: text('private_note'),
		abandonReason: text('abandon_reason'),
		createdBy: text('created_by'),
		validatedBy: text('validated_by'),
		validatedAt: timestamp('validated_at', { withTimezone: true }),
		/** Reprise Dolibarr : `llx_facture.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('counter_invoice_number_idx')
			.on(t.number)
			.where(sql`${t.number} IS NOT NULL`),
		index('counter_invoice_customer_idx').on(t.customerId),
		index('counter_invoice_status_idx').on(t.kind, t.status),
		index('counter_invoice_repair_idx').on(t.repairOrderId),
		uniqueIndex('counter_invoice_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export const counterInvoiceLine = pgTable(
	'counter_invoice_line',
	{
		id: serial('id').primaryKey(),
		invoiceId: integer('invoice_id')
			.notNull()
			.references(() => counterInvoice.id, { onDelete: 'cascade' }),
		position: integer('position').notNull().default(0),
		/** Produit ou prestation du catalogue ; null pour une ligne libre. */
		productId: integer('product_id').references(() => product.id, { onDelete: 'set null' }),
		label: text('label').notNull(),
		/** Détail imprimé sous la désignation : n° de série, garantie, caractéristiques. */
		description: text('description'),
		reference: text('reference'),
		/** Quantité, décimale pour la main-d'œuvre à l'heure (1,5 h). */
		quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull().default('1'),
		unitPriceHt: numeric('unit_price_ht', { precision: 12, scale: 4 }).notNull().default('0'),
		taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull().default('20'),
		discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
		/** Code comptable de vente, figé à la saisie (demande 2.1). */
		accountingCode: text('accounting_code'),
		/** Reprise Dolibarr : `llx_facturedet.rowid`. */
		legacyDoliId: integer('legacy_doli_id')
	},
	(t) => [
		index('counter_invoice_line_invoice_idx').on(t.invoiceId),
		uniqueIndex('counter_invoice_line_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type CounterInvoice = typeof counterInvoice.$inferSelect;
export type CounterInvoiceLine = typeof counterInvoiceLine.$inferSelect;

/**
 * Crédit d'un client, comme les « remises » de Dolibarr : acompte, avoir,
 * trop-perçu, reprise de machine, remise commerciale. Disponible tant qu'il
 * n'est pas utilisé ; utilisé, il est déduit d'une facture par une ligne
 * négative (`usedLineId`), ou il en a réglé une (`usedInvoiceId`, reprise).
 */
export const customerCredit = pgTable(
	'customer_credit',
	{
		id: serial('id').primaryKey(),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		description: text('description').notNull(),
		amountHt: numeric('amount_ht', { precision: 12, scale: 2 }).notNull(),
		amountTva: numeric('amount_tva', { precision: 12, scale: 2 }).notNull(),
		amountTtc: numeric('amount_ttc', { precision: 12, scale: 2 }).notNull(),
		taxRate: numeric('tax_rate', { precision: 6, scale: 3 }).notNull(),
		/** Facture d'acompte, avoir ou facture trop payée d'où vient le crédit. */
		sourceInvoiceId: integer('source_invoice_id').references(() => counterInvoice.id, {
			onDelete: 'set null'
		}),
		/** Ligne qui le déduit ; supprimer la ligne du brouillon libère le crédit. */
		usedLineId: integer('used_line_id').references(() => counterInvoiceLine.id, {
			onDelete: 'set null'
		}),
		/** Facture où le crédit a servi, reprise de Dolibarr (ligne ou règlement). */
		usedInvoiceId: integer('used_invoice_id').references(() => counterInvoice.id, {
			onDelete: 'set null'
		}),
		createdBy: text('created_by'),
		/** Reprise Dolibarr : `llx_societe_remise_except.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('customer_credit_customer_idx').on(t.customerId),
		index('customer_credit_used_line_idx').on(t.usedLineId),
		uniqueIndex('customer_credit_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type CustomerCredit = typeof customerCredit.$inferSelect;

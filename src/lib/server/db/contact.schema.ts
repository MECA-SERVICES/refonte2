/**
 * Interlocuteurs d'un client pro ou d'un fournisseur (service facturation,
 * commercial, livreur…), repris de Dolibarr (`llx_socpeople`). Un contact
 * appartient à un client **ou** à un fournisseur, jamais aux deux.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { customer } from './customer.schema';
import { supplier } from './catalog.schema';

export const contact = pgTable(
	'contact',
	{
		id: serial('id').primaryKey(),
		customerId: integer('customer_id').references(() => customer.id, { onDelete: 'cascade' }),
		supplierId: integer('supplier_id').references(() => supplier.id, { onDelete: 'cascade' }),
		/** « M. », « Mme »… */
		civility: text('civility'),
		firstName: text('first_name'),
		lastName: text('last_name').notNull(),
		/** Fonction ou rôle (« Facturation », « Commercial »…). */
		role: text('role'),
		email: text('email'),
		phone: text('phone'),
		mobile: text('mobile'),
		note: text('note'),
		isActive: boolean('is_active').notNull().default(true),
		/** Reprise Dolibarr : `llx_socpeople.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('contact_owner_check', sql`(${t.customerId} IS NULL) <> (${t.supplierId} IS NULL)`),
		index('contact_customer_idx').on(t.customerId),
		index('contact_supplier_idx').on(t.supplierId),
		uniqueIndex('contact_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type Contact = typeof contact.$inferSelect;

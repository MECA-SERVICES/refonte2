/**
 * Parc machines client — CDC section 32.
 *
 * Recense les équipements que possède un client, pour retrouver ses pièces
 * compatibles et préparer ses demandes d'atelier.
 *
 * Le parc s'alimente de deux façons : saisie manuelle du client, ou proposition
 * automatique à la livraison d'une machine. Une proposition entre au statut
 * `pending_confirmation` et attend que le client renseigne son numéro de série.
 */

import { sql } from 'drizzle-orm';
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { customer } from './customer.schema';
import { order, orderLine } from './order.schema';
import { product } from './catalog.schema';

/** Statuts d'une machine du parc. */
export type MachineStatus = 'pending_confirmation' | 'confirmed';

/** Origine de l'enregistrement. */
export type MachineSource = 'manual' | 'order' | 'repair_order';

export const clientMachine = pgTable(
	'client_machine',
	{
		id: serial('id').primaryKey(),

		/** Propriétaire. Une machine n'est jamais transférée (R3) ; la suppression
		 *  du compte emporte son parc (R22). */
		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'cascade' }),

		/** Nom d'usage donné par le client — obligatoire en saisie manuelle (R4). */
		name: text('name').notNull(),
		equipmentType: text('equipment_type').notNull(),

		brand: text('brand'),
		model: text('model'),
		/** Conditionne l'identification fiable des pièces compatibles (R5). */
		serialNumber: text('serial_number'),

		engineModel: text('engine_model'),
		engineSerialNumber: text('engine_serial_number'),

		warrantyInfo: text('warranty_info'),
		warrantyEndDate: timestamp('warranty_end_date', { withTimezone: true }),

		imageUrl: text('image_url'),
		/** Notes personnelles du client, jamais exposées ailleurs. */
		notes: text('notes'),

		status: text('status').notNull().default('confirmed'),
		source: text('source').notNull().default('manual'),

		// Rattachements d'origine : conservés pour la traçabilité, mais leur
		// disparition ne doit pas emporter la machine (R20).
		productId: integer('product_id').references(() => product.id, { onDelete: 'set null' }),
		orderId: integer('order_id').references(() => order.id, { onDelete: 'set null' }),
		orderLineId: integer('order_line_id').references(() => orderLine.id, { onDelete: 'set null' }),
		/** Ordre de réparation d'origine — la table viendra avec la section 31. */
		repairOrderId: integer('repair_order_id'),

		confirmedAt: timestamp('confirmed_at', { withTimezone: true }),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('client_machine_customer_idx').on(t.customerId),
		index('client_machine_status_idx').on(t.status),
		/**
		 * Un numéro de série est unique dans le parc d'un client (R17, R18).
		 *
		 * L'index ne porte que sur les valeurs renseignées : plusieurs machines
		 * peuvent attendre leur numéro sans se gêner.
		 */
		uniqueIndex('client_machine_serial_idx')
			.on(t.customerId, t.serialNumber)
			.where(sql`serial_number IS NOT NULL`),
		/** Sert le dédoublonnage des propositions automatiques (R15). */
		index('client_machine_order_line_idx').on(t.orderLineId)
	]
);

export type ClientMachine = typeof clientMachine.$inferSelect;
export type NewClientMachine = typeof clientMachine.$inferInsert;

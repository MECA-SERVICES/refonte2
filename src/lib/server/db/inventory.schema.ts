import {
	index,
	integer,
	numeric,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { product, stockLocation } from './catalog.schema';

/**
 * Inventaire annuel, repris du module Dolibarr « UTILE » : une campagne
 * (`utile_liste_inventaire`), des comptages par produit, emplacement et état
 * (`utile_inventaire` + `utile_type_inv`), et les numéros de série comptés
 * (`utile_numero_serie`). Valider une campagne remplace le stock par ce qui a
 * été compté, par des mouvements d'ajustement.
 */
export const inventoryStatus = ['open', 'validated'] as const;
export type InventoryStatus = (typeof inventoryStatus)[number];

export const inventory = pgTable(
	'inventory',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		status: text('status').notNull().default('open'),
		validatedAt: timestamp('validated_at', { withTimezone: true }),
		validatedBy: text('validated_by'),
		/** Reprise Dolibarr : `utile_liste_inventaire.id`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('inventory_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export const inventoryCount = pgTable(
	'inventory_count',
	{
		id: serial('id').primaryKey(),
		inventoryId: integer('inventory_id')
			.notNull()
			.references(() => inventory.id, { onDelete: 'cascade' }),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		locationId: integer('location_id')
			.notNull()
			.references(() => stockLocation.id, { onDelete: 'restrict' }),
		/** `stockCondition` : neuf, occasion, garantie. */
		condition: text('condition').notNull().default('new'),
		quantity: integer('quantity').notNull().default(0),
		/** Prix d'achat HT figé au comptage : il valorise l'inventaire. */
		purchasePrice: numeric('purchase_price', { precision: 12, scale: 4 }),
		note: text('note'),
		countedBy: text('counted_by'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('inventory_count_line_idx').on(
			t.inventoryId,
			t.productId,
			t.locationId,
			t.condition
		),
		index('inventory_count_location_idx').on(t.locationId)
	]
);

export const inventorySerial = pgTable(
	'inventory_serial',
	{
		id: serial('id').primaryKey(),
		inventoryCountId: integer('inventory_count_id')
			.notNull()
			.references(() => inventoryCount.id, { onDelete: 'cascade' }),
		serialNumber: text('serial_number').notNull()
	},
	(t) => [
		uniqueIndex('inventory_serial_line_idx').on(t.inventoryCountId, sql`upper(${t.serialNumber})`)
	]
);

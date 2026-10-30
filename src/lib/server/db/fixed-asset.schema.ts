/**
 * Immobilisations de l'entreprise (module UTILE de Dolibarr) : outillage et
 * matériel de l'atelier, du magasin et de l'activité paysage, avec leur prix
 * d'achat. Un registre simple : ni amortissement ni écriture comptable.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
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
import { product } from './catalog.schema';

/** Usages repris d'UTILE. */
export const fixedAssetUsages = ['Atelier', 'Magasin', 'Paysage'] as const;

export const fixedAsset = pgTable(
	'fixed_asset',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		/** Désignation complète, n° de série compris. */
		description: text('description'),
		/** Atelier, Magasin, Paysage… */
		usage: text('usage'),
		acquiredOn: date('acquired_on', { mode: 'string' }),
		purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }),
		/** Valeur retenue en comptabilité, si elle diffère du prix d'achat. */
		bookValue: numeric('book_value', { precision: 12, scale: 2 }),
		/** Produit du catalogue sorti du stock pour l'entreprise, le cas échéant. */
		productId: integer('product_id').references(() => product.id, { onDelete: 'set null' }),
		/** Faux une fois cédée, détruite ou hors service. */
		isActive: boolean('is_active').notNull().default(true),
		/** Reprise UTILE : `utile_immobilisation.id`. */
		legacyUtileId: integer('legacy_utile_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('fixed_asset_usage_idx').on(t.usage),
		uniqueIndex('fixed_asset_legacy_utile_id_idx')
			.on(t.legacyUtileId)
			.where(sql`${t.legacyUtileId} IS NOT NULL`)
	]
);

export type FixedAsset = typeof fixedAsset.$inferSelect;

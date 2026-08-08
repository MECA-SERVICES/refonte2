import {
	pgTable,
	serial,
	integer,
	text,
	varchar,
	boolean,
	numeric,
	timestamp,
	jsonb,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customer } from './customer.schema';
import { product, productVariant } from './catalog.schema';

/**
 * Domaine « Panier & Commande ».
 *
 * Migration depuis PrestaShop : les 65 états legacy (doublons ps_* + tests) sont
 * remplacés par un jeu unifié et cohérent (voir ORDER_STATE_SEED plus bas), avec
 * un `code` stable. `legacy_ps_id` conserve le lien pour l'import des données.
 */

// ---------------------------------------------------------------------------
// États de commande
// ---------------------------------------------------------------------------

export const orderState = pgTable(
	'order_state',
	{
		id: serial('id').primaryKey(),
		/** Code stable (snake_case) — identifiant métier de l'état. */
		code: text('code').notNull(),
		label: text('label').notNull(),
		color: varchar('color', { length: 7 }).notNull().default('#6b7280'),
		position: integer('position').notNull().default(0),

		/** Drapeaux métier (repris du système PrestaShop). */
		isPaid: boolean('is_paid').notNull().default(false),
		isShipped: boolean('is_shipped').notNull().default(false),
		isFinal: boolean('is_final').notNull().default(false),
		/** Cache l'état côté client (usage interne). */
		hideFromClient: boolean('hide_from_client').notNull().default(false),
		/** Envoie un email au client lors du passage à cet état. */
		sendEmailOnChange: boolean('send_email_on_change').notNull().default(false),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('order_state_code_idx').on(t.code)]
);

// ---------------------------------------------------------------------------
// Paniers
// ---------------------------------------------------------------------------

export const cart = pgTable(
	'cart',
	{
		id: serial('id').primaryKey(),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'cascade' }),

		promoCodeId: integer('promo_code_id'),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('cart_customer_idx').on(t.customerId),
		// Tri par défaut de la liste des paniers admin.
		index('cart_last_activity_idx').on(t.lastActivityAt)
	]
);

export const cartItem = pgTable(
	'cart_item',
	{
		id: serial('id').primaryKey(),
		cartId: integer('cart_id')
			.notNull()
			.references(() => cart.id, { onDelete: 'cascade' }),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		variantId: integer('variant_id').references(() => productVariant.id, { onDelete: 'set null' }),
		quantity: integer('quantity').notNull().default(1),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('cart_item_cart_idx').on(t.cartId),
		// Index de FK, même raison que `order_line` ci-dessous : sans eux, toute
		// suppression de produit scanne la table entière.
		index('cart_item_product_idx').on(t.productId),
		index('cart_item_variant_idx').on(t.variantId)
	]
);

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------

export const order = pgTable(
	'order',
	{
		id: serial('id').primaryKey(),
		/** Référence lisible (ex. « CMD-2026-000123 »). */
		reference: text('reference').notNull(),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),
		stateId: integer('state_id')
			.notNull()
			.references(() => orderState.id, { onDelete: 'restrict' }),

		// Totaux
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
		shippingFee: numeric('shipping_fee', { precision: 10, scale: 2 }).notNull().default('0'),
		discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),

		// Adresses figées au moment de la commande (snapshot).
		shippingAddress: jsonb('shipping_address'),
		billingAddress: jsonb('billing_address'),

		// Livraison / suivi
		carrierId: integer('carrier_id'),
		trackingNumber: text('tracking_number'),
		trackingUrl: text('tracking_url'),
		packageWeightKg: numeric('package_weight_kg', { precision: 10, scale: 3 }),

		// Paiement
		paymentProvider: text('payment_provider'),
		paymentReference: text('payment_reference'),
		paidAt: timestamp('paid_at', { withTimezone: true }),

		// Notes
		invoiceNote: text('invoice_note'),
		privateNote: text('private_note'),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		deliveredAt: timestamp('delivered_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('order_reference_idx').on(t.reference),
		index('order_customer_idx').on(t.customerId),
		index('order_state_idx').on(t.stateId),
		// Tri par défaut de la liste admin (plus récentes d'abord).
		index('order_created_at_idx').on(t.createdAt),
		// Le filtre référence fait un ILIKE '%terme%' que l'index unique btree ne sert pas.
		index('order_reference_trgm_idx').using('gin', t.reference.op('gin_trgm_ops'))
	]
);

/** Lignes de commande — snapshot du produit au moment de l'achat. */
export const orderLine = pgTable(
	'order_line',
	{
		id: serial('id').primaryKey(),
		orderId: integer('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'cascade' }),
		/** Produit d'origine (null si supprimé depuis). */
		productId: integer('product_id').references(() => product.id, { onDelete: 'set null' }),
		variantId: integer('variant_id').references(() => productVariant.id, { onDelete: 'set null' }),

		// Snapshot (le produit peut changer/disparaître après la commande).
		productName: text('product_name').notNull(),
		productReference: text('product_reference'),
		productImageUrl: text('product_image_url'),

		unitPriceHt: numeric('unit_price_ht', { precision: 12, scale: 4 }).notNull(),
		unitPriceTtc: numeric('unit_price_ttc', { precision: 12, scale: 4 }).notNull(),
		quantity: integer('quantity').notNull().default(1),
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull(),
		totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull(),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('order_line_order_idx').on(t.orderId),
		// Index de clé étrangère — Postgres n'en crée pas automatiquement.
		// Sans eux, toute suppression de produit doit scanner l'intégralité de
		// `order_line` pour appliquer le `ON DELETE SET NULL`. Mesuré sur sakura
		// le 2026-08-08 : la purge du catalogue (1,3 M de produits) tournait
		// encore après 9 minutes ; avec ces index, elle passe en quelques
		// secondes. Vaut aussi pour toute suppression de produit depuis l'admin.
		index('order_line_product_idx').on(t.productId),
		index('order_line_variant_idx').on(t.variantId)
	]
);

/** Historique des changements d'état d'une commande. */
export const orderStateHistory = pgTable(
	'order_state_history',
	{
		id: serial('id').primaryKey(),
		orderId: integer('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'cascade' }),
		stateId: integer('state_id')
			.notNull()
			.references(() => orderState.id, { onDelete: 'restrict' }),
		/** Utilisateur (better-auth) ayant effectué le changement. */
		changedBy: text('changed_by'),
		note: text('note'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('order_state_history_order_idx').on(t.orderId)]
);

// ---------------------------------------------------------------------------
// Relations Drizzle
// ---------------------------------------------------------------------------

export const orderStateRelations = relations(orderState, ({ many }) => ({
	orders: many(order)
}));

export const cartRelations = relations(cart, ({ one, many }) => ({
	customer: one(customer, { fields: [cart.customerId], references: [customer.id] }),
	items: many(cartItem)
}));

export const cartItemRelations = relations(cartItem, ({ one }) => ({
	cart: one(cart, { fields: [cartItem.cartId], references: [cart.id] }),
	product: one(product, { fields: [cartItem.productId], references: [product.id] }),
	variant: one(productVariant, { fields: [cartItem.variantId], references: [productVariant.id] })
}));

export const orderRelations = relations(order, ({ one, many }) => ({
	customer: one(customer, { fields: [order.customerId], references: [customer.id] }),
	state: one(orderState, { fields: [order.stateId], references: [orderState.id] }),
	lines: many(orderLine),
	history: many(orderStateHistory)
}));

export const orderLineRelations = relations(orderLine, ({ one }) => ({
	order: one(order, { fields: [orderLine.orderId], references: [order.id] })
}));

export const orderStateHistoryRelations = relations(orderStateHistory, ({ one }) => ({
	order: one(order, { fields: [orderStateHistory.orderId], references: [order.id] }),
	state: one(orderState, { fields: [orderStateHistory.stateId], references: [orderState.id] })
}));

// ---------------------------------------------------------------------------
// Jeu d'états initial (unifié depuis PrestaShop)
// ---------------------------------------------------------------------------

export const ORDER_STATE_SEED = [
	{ code: 'pending', label: 'En attente', color: '#f59e0b', position: 10 },
	{
		code: 'awaiting_payment',
		label: 'En attente de paiement',
		color: '#4169E1',
		position: 20
	},
	{
		code: 'payment_accepted',
		label: 'Paiement accepté',
		color: '#32CD32',
		position: 30,
		isPaid: true,
		sendEmailOnChange: true
	},
	{ code: 'payment_error', label: 'Erreur de paiement', color: '#8f0621', position: 40 },
	{
		code: 'validation',
		label: 'En cours de validation',
		color: '#FF69B4',
		position: 50
	},
	{
		code: 'preparing',
		label: 'Préparation en cours',
		color: '#FF8C00',
		position: 60,
		isPaid: true,
		sendEmailOnChange: true
	},
	{
		code: 'partial_prep',
		label: 'Préparation partielle',
		color: '#f700d1',
		position: 65,
		isPaid: true
	},
	{
		code: 'supplier_order',
		label: 'Commandée chez le fournisseur',
		color: '#c40069',
		position: 70,
		isPaid: true
	},
	{
		code: 'shipping',
		label: 'En cours de livraison',
		color: '#8A2BE2',
		position: 80,
		isPaid: true,
		isShipped: true,
		sendEmailOnChange: true
	},
	{
		code: 'delivered',
		label: 'Livré',
		color: '#108510',
		position: 90,
		isPaid: true,
		isShipped: true,
		isFinal: true
	},
	{
		code: 'delivery_dispute',
		label: 'Litige de livraison',
		color: '#ff0000',
		position: 95,
		isPaid: true,
		isShipped: true,
		sendEmailOnChange: true
	},
	{
		code: 'cancelled',
		label: 'Annulé',
		color: '#DC143C',
		position: 100,
		isFinal: true,
		sendEmailOnChange: true
	},
	{
		code: 'refunded',
		label: 'Remboursé',
		color: '#ec2e15',
		position: 110,
		isFinal: true,
		sendEmailOnChange: true
	},
	{
		code: 'refunded_voucher',
		label: 'Remboursé par avoir',
		color: '#a1f8a1',
		position: 120,
		isFinal: true,
		sendEmailOnChange: true
	}
] as const;

// ---------------------------------------------------------------------------
// Types inférés
// ---------------------------------------------------------------------------

export type OrderState = typeof orderState.$inferSelect;
export type NewOrderState = typeof orderState.$inferInsert;
export type Cart = typeof cart.$inferSelect;
export type CartItem = typeof cartItem.$inferSelect;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type OrderLine = typeof orderLine.$inferSelect;
export type NewOrderLine = typeof orderLine.$inferInsert;

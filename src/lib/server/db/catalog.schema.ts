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
	uniqueIndex,
	index,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Domaine « Catalogue » — marques, catégories, produits, variantes, médias, relations.
 *
 * Traçabilité de la reprise PrestaShop : chaque table porte un `legacy_ps_id` nullable
 * renseigné par le futur import des données.
 */

// ---------------------------------------------------------------------------
// Marques
// ---------------------------------------------------------------------------

export const brand = pgTable(
	'brand',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		logoUrl: text('logo_url'),
		isActive: boolean('is_active').notNull().default(true),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('brand_slug_idx').on(t.slug)]
);

// ---------------------------------------------------------------------------
// Catégories (arborescence via parent_id auto-référent)
// ---------------------------------------------------------------------------

export const category = pgTable(
	'category',
	{
		id: serial('id').primaryKey(),
		parentId: integer('parent_id').references((): AnyPgColumn => category.id, {
			onDelete: 'set null'
		}),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		isActive: boolean('is_active').notNull().default(true),
		position: integer('position').notNull().default(0),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('category_slug_idx').on(t.slug), index('category_parent_idx').on(t.parentId)]
);

// ---------------------------------------------------------------------------
// Règles de TVA
// ---------------------------------------------------------------------------

export const taxRule = pgTable('tax_rule', {
	id: serial('id').primaryKey(),
	/** Libellé, ex. « Taux normal 20 % ». */
	name: text('name').notNull(),
	/** Taux en pourcentage, ex. 20.00, 5.50. */
	rate: numeric('rate', { precision: 6, scale: 3 }).notNull(),
	isActive: boolean('is_active').notNull().default(true),
	/** Taux appliqué par défaut aux nouveaux produits. */
	isDefault: boolean('is_default').notNull().default(false),

	legacyPsId: integer('legacy_ps_id'),

	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

export const product = pgTable(
	'product',
	{
		id: serial('id').primaryKey(),

		// Utils
		isActive: boolean('is_active').notNull().default(true),

		// Identification
		name: text('name').notNull(),
		/** SKU interne. */
		reference: text('reference').notNull(),
		/** Référence fournisseur. */
		supplierReference: text('supplier_reference'),
		/** Code-barres EAN13. */
		ean13: varchar('ean13', { length: 13 }),
		brandId: integer('brand_id').references(() => brand.id, { onDelete: 'set null' }),

		// SEO / présentation
		slug: text('slug').notNull(),
		shortDescription: text('short_description'),
		description: text('description'),
		metaTitle: text('meta_title'),
		metaDescription: text('meta_description'),

		// Tarification
		priceHt: numeric('price_ht', { precision: 12, scale: 4 }).notNull(),
		/** Prix HT barré (avant remise). */
		priceHtStrike: numeric('price_ht_strike', { precision: 12, scale: 4 }),
		purchasePrice: numeric('purchase_price', { precision: 12, scale: 4 }),
		/** Règle de TVA appliquée (null = pas de TVA / exonéré). */
		taxRuleId: integer('tax_rule_id').references(() => taxRule.id, { onDelete: 'set null' }),

		// Stock & logistique
		stock: integer('stock').notNull().default(0),
		weightKg: numeric('weight_kg', { precision: 10, scale: 3 }),
		lengthCm: numeric('length_cm', { precision: 10, scale: 2 }),
		widthCm: numeric('width_cm', { precision: 10, scale: 2 }),
		heightCm: numeric('height_cm', { precision: 10, scale: 2 }),
		shippingExtraFee: numeric('shipping_extra_fee', { precision: 10, scale: 2 }),
		/** Transporteur forcé — FK à brancher quand le domaine livraison existera. */
		forcedCarrierId: integer('forced_carrier_id'),
		/** Fournisseur — FK à brancher quand le domaine fournisseurs existera. */
		supplierId: integer('supplier_id'),

		// Catégorisation : catégorie principale (les catégories additionnelles
		// passent par la table de liaison product_category).
		categoryId: integer('category_id').references(() => category.id, { onDelete: 'set null' }),

		// Traçabilité import
		legacyPsId: integer('legacy_ps_id'),

		// Dates
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		/** Dernière modification du prix. */
		priceUpdatedAt: timestamp('price_updated_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('product_slug_idx').on(t.slug),
		uniqueIndex('product_reference_idx').on(t.reference),
		index('product_brand_idx').on(t.brandId),
		index('product_category_idx').on(t.categoryId)
	]
);

// ---------------------------------------------------------------------------
// Variantes (déclinaisons) — attributs libres en JSON, ex. {"Pointure":"39"}
// ---------------------------------------------------------------------------

export const productVariant = pgTable(
	'product_variant',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),

		name: text('name').notNull(),
		/** Attributs de la variante, ex. {"Pointure":"39","Couleur":"Noir"}. */
		attributes: jsonb('attributes').$type<Record<string, string>>(),
		reference: text('reference'),
		ean13: varchar('ean13', { length: 13 }),
		/** Impact sur le prix HT (delta appliqué au prix du produit). */
		priceImpact: numeric('price_impact', { precision: 12, scale: 4 }).notNull().default('0'),
		/** Impact sur le poids (kg). */
		weightImpact: numeric('weight_impact', { precision: 10, scale: 3 }).notNull().default('0'),
		stock: integer('stock').notNull().default(0),
		imageUrl: text('image_url'),
		isDefault: boolean('is_default').notNull().default(false),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('product_variant_product_idx').on(t.productId)]
);

// ---------------------------------------------------------------------------
// Mouvements de stock (inventory) — historique traçable
// ---------------------------------------------------------------------------

/** Nature d'un mouvement de stock. */
export const stockMovementType = [
	'in', // entrée (réapprovisionnement)
	'out', // sortie manuelle
	'adjustment', // ajustement d'inventaire (correction)
	'order', // décrément suite à une commande
	'return' // incrément suite à un retour
] as const;
export type StockMovementType = (typeof stockMovementType)[number];

export const stockMovement = pgTable(
	'stock_movement',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		/** Variante concernée (null = produit simple). */
		variantId: integer('variant_id').references(() => productVariant.id, { onDelete: 'cascade' }),
		/** Quantité du mouvement (positive = entrée, négative = sortie). */
		quantity: integer('quantity').notNull(),
		type: text('type').notNull(),
		note: text('note'),
		/** Utilisateur à l'origine du mouvement (id better-auth), si applicable. */
		createdBy: text('created_by'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('stock_movement_product_idx').on(t.productId),
		index('stock_movement_variant_idx').on(t.variantId)
	]
);

// ---------------------------------------------------------------------------
// Médias (images, vidéos, PDF de vue éclatée) — ordonnés
// ---------------------------------------------------------------------------

/** Types de média supportés. */
export const productMediaType = ['image', 'video', 'pdf'] as const;
export type ProductMediaType = (typeof productMediaType)[number];

export const productMedia = pgTable(
	'product_media',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),

		type: text('type').notNull().default('image'),
		url: text('url').notNull(),
		alt: text('alt'),
		position: integer('position').notNull().default(0),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('product_media_product_idx').on(t.productId)]
);

// ---------------------------------------------------------------------------
// Relations produit ↔ produit (remplacement, alternatifs)
// ---------------------------------------------------------------------------

/** Types de relation entre produits. */
export const productRelationType = ['replacement', 'alternative'] as const;
export type ProductRelationType = (typeof productRelationType)[number];

export const productRelation = pgTable(
	'product_relation',
	{
		id: serial('id').primaryKey(),
		/** Produit source (celui affiché). */
		fromProductId: integer('from_product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		/** Produit lié (remplaçant ou alternatif). */
		toProductId: integer('to_product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		position: integer('position').notNull().default(0)
	},
	(t) => [
		index('product_relation_from_idx').on(t.fromProductId),
		uniqueIndex('product_relation_unique_idx').on(t.fromProductId, t.toProductId, t.type)
	]
);

// ---------------------------------------------------------------------------
// Produit ↔ catégories additionnelles (N-N)
// ---------------------------------------------------------------------------

export const productCategory = pgTable(
	'product_category',
	{
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'cascade' })
	},
	(t) => [uniqueIndex('product_category_unique_idx').on(t.productId, t.categoryId)]
);

// ---------------------------------------------------------------------------
// Relations Drizzle (API relationnelle)
// ---------------------------------------------------------------------------

export const brandRelations = relations(brand, ({ many }) => ({
	products: many(product)
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
	parent: one(category, {
		fields: [category.parentId],
		references: [category.id],
		relationName: 'category_tree'
	}),
	children: many(category, { relationName: 'category_tree' }),
	products: many(product)
}));

export const taxRuleRelations = relations(taxRule, ({ many }) => ({
	products: many(product)
}));

export const productRelations = relations(product, ({ one, many }) => ({
	brand: one(brand, { fields: [product.brandId], references: [brand.id] }),
	category: one(category, { fields: [product.categoryId], references: [category.id] }),
	taxRule: one(taxRule, { fields: [product.taxRuleId], references: [taxRule.id] }),
	variants: many(productVariant),
	media: many(productMedia),
	movements: many(stockMovement),
	additionalCategories: many(productCategory)
}));

export const stockMovementRelations = relations(stockMovement, ({ one }) => ({
	product: one(product, { fields: [stockMovement.productId], references: [product.id] }),
	variant: one(productVariant, {
		fields: [stockMovement.variantId],
		references: [productVariant.id]
	})
}));

export const productVariantRelations = relations(productVariant, ({ one }) => ({
	product: one(product, { fields: [productVariant.productId], references: [product.id] })
}));

export const productMediaRelations = relations(productMedia, ({ one }) => ({
	product: one(product, { fields: [productMedia.productId], references: [product.id] })
}));

export const productCategoryRelations = relations(productCategory, ({ one }) => ({
	product: one(product, { fields: [productCategory.productId], references: [product.id] }),
	category: one(category, { fields: [productCategory.categoryId], references: [category.id] })
}));

// ---------------------------------------------------------------------------
// Types inférés
// ---------------------------------------------------------------------------

export type Brand = typeof brand.$inferSelect;
export type NewBrand = typeof brand.$inferInsert;
export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductVariant = typeof productVariant.$inferSelect;
export type NewProductVariant = typeof productVariant.$inferInsert;
export type ProductMedia = typeof productMedia.$inferSelect;
export type NewProductMedia = typeof productMedia.$inferInsert;
export type ProductRelation = typeof productRelation.$inferSelect;
export type NewProductRelation = typeof productRelation.$inferInsert;
export type TaxRule = typeof taxRule.$inferSelect;
export type NewTaxRule = typeof taxRule.$inferInsert;
export type StockMovement = typeof stockMovement.$inferSelect;
export type NewStockMovement = typeof stockMovement.$inferInsert;

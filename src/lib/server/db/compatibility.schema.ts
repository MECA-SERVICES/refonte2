import {
	pgTable,
	serial,
	integer,
	text,
	boolean,
	timestamp,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { product } from './catalog.schema';

/**
 * Domaine « Compatibilité machines » — étape 3 du chantier catalogue
 * (voir `MIGRATION-CATALOGUE.md` §4.1 règle n°2 et §6.3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Pourquoi ces tables existent
 *
 *  Dans PrestaShop, la compatibilité est encodée **dans l'arbre des catégories** :
 *  `Pièces détachées > BRIGGS STRATTON > TONDEUSES > 46CM > ...`. C'est la cause
 *  directe des 5 948 catégories sur 12 niveaux, dont 93 % vides — chaque modèle
 *  de machine y duplique les mêmes nœuds (`Plateau de coupe` ×34, `Options` ×30).
 *
 *  La compatibilité est en réalité une relation **N-N** entre une pièce et des
 *  modèles de machine, pas un rangement. Une courroie compatible avec 12 modèles
 *  devient ici 1 produit + 12 liaisons, au lieu de 12 catégories.
 *
 *  C'est aussi ce qui permet le sélecteur « Ma machine », principal levier de
 *  conversion du métier : le client choisit sa machine, on filtre le catalogue.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Marques de machines
// ---------------------------------------------------------------------------

/**
 * Constructeur de machine — ISEKI, HUSQVARNA, BRIGGS & STRATTON…
 *
 * Volontairement **distinct** de `brand` (catalog.schema.ts) : `brand` est la
 * marque qui *fabrique la pièce vendue*, `machineBrand` la marque de l'engin sur
 * lequel elle se monte. Une pièce KRAMP peut équiper une machine ISEKI ; les
 * confondre rendrait le sélecteur « Ma machine » inutilisable.
 */
export const machineBrand = pgTable(
	'machine_brand',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		logoUrl: text('logo_url'),
		isActive: boolean('is_active').notNull().default(true),

		/** `ps_category.id_category` du nœud d'origine, pour la traçabilité. */
		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('machine_brand_slug_idx').on(t.slug)]
);

// ---------------------------------------------------------------------------
// Modèles de machines
// ---------------------------------------------------------------------------

/**
 * Modèle précis — « SF224 », « TS 60 », avec ses années de production.
 *
 * Les années sont **nullables et bornées** (`yearFrom` / `yearTo`) : la source
 * ne les renseigne pas toujours, et un modèle encore produit n'a pas de fin.
 * Une pièce peut donc être compatible avec un modèle sur une plage d'années
 * plus étroite que la vie du modèle — d'où les mêmes bornes sur la liaison.
 */
export const machineModel = pgTable(
	'machine_model',
	{
		id: serial('id').primaryKey(),
		brandId: integer('brand_id')
			.notNull()
			.references(() => machineBrand.id, { onDelete: 'cascade' }),

		name: text('name').notNull(),
		slug: text('slug').notNull(),
		/** Type d'engin : tondeuse, tracteur, tronçonneuse… (libre, alimenté par l'import). */
		machineType: text('machine_type'),
		/** Première année de production connue. */
		yearFrom: integer('year_from'),
		/** Dernière année de production connue (null = toujours produit). */
		yearTo: integer('year_to'),
		isActive: boolean('is_active').notNull().default(true),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('machine_model_brand_idx').on(t.brandId),
		// Deux constructeurs peuvent nommer un modèle pareil : l'unicité est
		// donc sur le couple, jamais sur le slug seul.
		uniqueIndex('machine_model_brand_slug_idx').on(t.brandId, t.slug)
	]
);

// ---------------------------------------------------------------------------
// Compatibilité pièce ↔ modèle (N-N)
// ---------------------------------------------------------------------------

/** D'où vient l'information de compatibilité — pour pouvoir la rejouer ou la corriger. */
export const compatibilitySource = [
	'legacy', // déduite de l'arbre PrestaShop à la migration
	'rule', // déduite par une règle automatique
	'manual', // saisie ou validée par un humain
	'supplier' // fournie par un catalogue fournisseur
] as const;
export type CompatibilitySource = (typeof compatibilitySource)[number];

/**
 * « Cette pièce se monte sur ce modèle. »
 *
 * `yearFrom` / `yearTo` permettent de restreindre la compatibilité à une plage
 * plus étroite que la vie du modèle (une pièce révisée en cours de série).
 * Laissés à `null`, la compatibilité vaut pour tout le modèle.
 *
 * `source` est indispensable : sans lui, impossible de distinguer une
 * compatibilité validée par un humain d'une déduite automatiquement — donc
 * impossible de corriger une règle en masse sans écraser le travail manuel.
 */
export const productCompatibility = pgTable(
	'product_compatibility',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		modelId: integer('model_id')
			.notNull()
			.references(() => machineModel.id, { onDelete: 'cascade' }),

		yearFrom: integer('year_from'),
		yearTo: integer('year_to'),

		source: text('source').notNull().default('legacy'),
		/** Règle ayant produit la liaison, quand `source = 'rule'`. */
		rule: text('rule'),
		/** Note libre (référence constructeur, réserve du technicien…). */
		note: text('note'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('product_compatibility_product_idx').on(t.productId),
		// Sens de lecture principal du sélecteur « Ma machine » : partir du
		// modèle pour lister les pièces.
		index('product_compatibility_model_idx').on(t.modelId),
		uniqueIndex('product_compatibility_unique_idx').on(t.productId, t.modelId)
	]
);

// ---------------------------------------------------------------------------
// Relations Drizzle
// ---------------------------------------------------------------------------

export const machineBrandRelations = relations(machineBrand, ({ many }) => ({
	models: many(machineModel)
}));

export const machineModelRelations = relations(machineModel, ({ one, many }) => ({
	brand: one(machineBrand, {
		fields: [machineModel.brandId],
		references: [machineBrand.id]
	}),
	compatibilities: many(productCompatibility)
}));

export const productCompatibilityRelations = relations(productCompatibility, ({ one }) => ({
	product: one(product, {
		fields: [productCompatibility.productId],
		references: [product.id]
	}),
	model: one(machineModel, {
		fields: [productCompatibility.modelId],
		references: [machineModel.id]
	})
}));

// ---------------------------------------------------------------------------
// Types inférés
// ---------------------------------------------------------------------------

export type MachineBrand = typeof machineBrand.$inferSelect;
export type NewMachineBrand = typeof machineBrand.$inferInsert;
export type MachineModel = typeof machineModel.$inferSelect;
export type NewMachineModel = typeof machineModel.$inferInsert;
export type ProductCompatibility = typeof productCompatibility.$inferSelect;
export type NewProductCompatibility = typeof productCompatibility.$inferInsert;

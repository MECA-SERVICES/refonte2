/**
 * Page d'accueil réglable en back-office (demandes client 10.1, 10.3, 10.4).
 *
 * Les images sont des adresses, comme partout ailleurs dans le catalogue : le
 * site n'a pas encore de stockage de fichiers. Sans réglage, l'accueil garde
 * ses blocs automatiques (stock atelier, rayons du menu).
 */
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { category, product } from './catalog.schema';

/** Teinte d'une tuile promotionnelle, ou photo plein cadre. */
export const homeTileTones = ['blue', 'red', 'dark', 'photo'] as const;
export type HomeTileTone = (typeof homeTileTones)[number];

/** Tuiles promotionnelles « à la Kramp », à la place de « Nos marques » (10.1). */
export const homePromoTile = pgTable('home_promo_tile', {
	id: serial('id').primaryKey(),
	/** Surtitre en capitales : « PROMOTION », « BRIGGS & STRATTON, HONDA… ». */
	eyebrow: text('eyebrow'),
	title: text('title').notNull(),
	imageUrl: text('image_url'),
	linkUrl: text('link_url').notNull(),
	buttonLabel: text('button_label').notNull().default('Je découvre'),
	tone: text('tone').$type<HomeTileTone>().notNull().default('blue'),
	/** Pastille ronde, ex. « PROMO » ; vide pour n'en mettre aucune. */
	badge: text('badge'),
	position: integer('position').notNull().default(0),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** Catégories mises en avant, chacune avec son visuel (10.3). */
export const homeFeaturedCategory = pgTable('home_featured_category', {
	categoryId: integer('category_id')
		.primaryKey()
		.references(() => category.id, { onDelete: 'cascade' }),
	imageUrl: text('image_url'),
	position: integer('position').notNull().default(0)
});

/** Produits phares choisis à la main (10.4). */
export const homeFeaturedProduct = pgTable('home_featured_product', {
	productId: integer('product_id')
		.primaryKey()
		.references(() => product.id, { onDelete: 'cascade' }),
	position: integer('position').notNull().default(0)
});

/** Réglages simples de l'accueil, en clé / valeur (visuel des produits phares…). */
export const homeSetting = pgTable('home_setting', {
	key: text('key').primaryKey(),
	value: text('value')
});

export type HomePromoTile = typeof homePromoTile.$inferSelect;

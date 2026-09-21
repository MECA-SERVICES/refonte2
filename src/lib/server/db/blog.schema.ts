/**
 * Blog éditorial — CDC section 33.
 *
 * Distinct des pages CMS : un article porte un auteur, une catégorie, un cycle
 * de publication et un compteur de consultations. Une page, non.
 */

import {
	type AnyPgColumn,
	boolean,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const blogCategory = pgTable(
	'blog_category',
	{
		id: serial('id').primaryKey(),

		/*
		 * Catégorie parente (arborescence auto-référente), sur le modèle du
		 * catalogue produit.
		 *
		 * `set null` plutôt que `restrict` : supprimer un parent remonte ses
		 * enfants à la racine au lieu de bloquer. R15 protège déjà, plus haut,
		 * les catégories qui portent des articles.
		 */
		parentId: integer('parent_id').references((): AnyPgColumn => blogCategory.id, {
			onDelete: 'set null'
		}),

		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),

		/** Identité visuelle de la catégorie, reprise sur les vignettes. */
		color: text('color'),
		icon: text('icon'),

		/** Ordre fixé manuellement (R16). */
		sortOrder: integer('sort_order').notNull().default(0),
		/** Masquée, la catégorie sort de la navigation (R14). */
		isActive: boolean('is_active').notNull().default(true),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('blog_category_slug_idx').on(t.slug),
		index('blog_category_order_idx').on(t.sortOrder),
		index('blog_category_parent_idx').on(t.parentId)
	]
);

/** Forme du contenu : rédigé, vidéo, ou renvoi vers un contenu externe. */
export type BlogContentType = 'article' | 'video' | 'external_link';

/** Cycle éditorial d'un article. */
export type BlogStatus = 'draft' | 'published' | 'archived';

export const blogArticle = pgTable(
	'blog_article',
	{
		id: serial('id').primaryKey(),
		slug: text('slug').notNull(),
		title: text('title').notNull(),

		/** `article`, `video` ou `external_link` (R7). */
		contentType: text('content_type').notNull().default('article'),
		/** Corps rédigé, produit par l'éditeur ; assaini à l'affichage. */
		content: text('content').notNull().default(''),
		videoUrl: text('video_url'),
		externalUrl: text('external_url'),

		coverImageUrl: text('cover_image_url'),
		/** Résumé affiché en liste — obligatoire avant publication (R8). */
		excerpt: text('excerpt'),

		metaTitle: text('meta_title'),
		metaDescription: text('meta_description'),

		blogCategoryId: integer('blog_category_id').references(() => blogCategory.id, {
			// Une catégorie contenant des articles n'est pas supprimable (R15) :
			// la contrainte le garantit au niveau de la base.
			onDelete: 'restrict'
		}),

		/** Auteur, choisi parmi les comptes internes (R5). */
		authorUserId: text('author_user_id').references(() => user.id, { onDelete: 'set null' }),

		/** `draft`, `published` ou `archived`. */
		status: text('status').notNull().default('draft'),
		/** Renseignée au passage en publication (R4). */
		publishedAt: timestamp('published_at', { withTimezone: true }),

		/** Incrémenté à chaque affichage public (R17). */
		viewCount: integer('view_count').notNull().default(0),

		/**
		 * Jeton d'aperçu d'un brouillon (R9-R12).
		 *
		 * Stocké en clair mais imprévisible : une nouvelle émission remplace le
		 * précédent, ce qui vaut révocation.
		 */
		previewToken: text('preview_token'),
		previewTokenExpiresAt: timestamp('preview_token_expires_at', { withTimezone: true }),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('blog_article_slug_idx').on(t.slug),
		// Liste publique : articles publiés, les plus récents d'abord.
		index('blog_article_status_published_idx').on(t.status, t.publishedAt),
		index('blog_article_category_idx').on(t.blogCategoryId)
	]
);

export type BlogCategory = typeof blogCategory.$inferSelect;
export type NewBlogCategory = typeof blogCategory.$inferInsert;
export type BlogArticle = typeof blogArticle.$inferSelect;
export type NewBlogArticle = typeof blogArticle.$inferInsert;

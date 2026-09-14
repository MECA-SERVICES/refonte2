/**
 * Pages éditoriales — mentions légales, CGV, à propos, livraison…
 *
 * Distinct du blog décrit en section 33 du cahier des charges : une page CMS
 * n'a ni auteur, ni catégorie, ni date de publication. Elle existe à une adresse
 * stable et se contente d'être à jour.
 */

import { boolean, index, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const cmsPage = pgTable(
	'cms_page',
	{
		id: serial('id').primaryKey(),

		/** Adresse publique de la page : `/p/<slug>`. */
		slug: text('slug').notNull(),
		title: text('title').notNull(),

		/**
		 * Contenu HTML produit par l'éditeur.
		 *
		 * Stocké en HTML plutôt qu'au format interne de l'éditeur : la page reste
		 * lisible et affichable même si l'outil de rédaction change un jour.
		 * Assaini à l'affichage par `sanitizeHtml`.
		 */
		content: text('content').notNull().default(''),

		/** Une page non publiée reste accessible en back-office uniquement. */
		isPublished: boolean('is_published').notNull().default(false),

		// Référencement (CDC 39, R8 et R9)
		metaTitle: text('meta_title'),
		metaDescription: text('meta_description'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		// L'adresse publique doit être unique : deux pages homonymes rendraient
		// l'une des deux inatteignable.
		uniqueIndex('cms_page_slug_idx').on(t.slug),
		index('cms_page_published_idx').on(t.isPublished)
	]
);

export type CmsPage = typeof cmsPage.$inferSelect;
export type NewCmsPage = typeof cmsPage.$inferInsert;

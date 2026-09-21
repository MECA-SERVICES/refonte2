/**
 * Demandes de validation de compte — CDC section 08.
 *
 * Une demande est ouverte à chaque soumission de dossier professionnel ou de
 * collectivité. L'historique est intégralement conservé : un client refusé qui
 * corrige et resoumet crée une **nouvelle** demande, sans effacer la
 * précédente (R10). Le `status` de `customer` reflète la décision de la
 * demande la plus récente.
 */

import { index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customer } from './customer.schema';
import { user } from './auth.schema';

export const accountValidationRequest = pgTable(
	'account_validation_request',
	{
		id: serial('id').primaryKey(),

		customerId: integer('customer_id')
			.notNull()
			// Le dossier n'a plus d'objet si la fiche client disparaît.
			.references(() => customer.id, { onDelete: 'cascade' }),

		/** `pro` ou `collectivite` — voir `$lib/accounts`. */
		requestType: text('request_type').notNull(),

		/** `pending`, `validated` ou `rejected`. */
		status: text('status').notNull().default('pending'),

		/**
		 * Informations déclarées au moment de la soumission.
		 *
		 * Figées volontairement : la fiche client évolue, le dossier examiné
		 * doit rester consultable tel qu'il a été soumis.
		 */
		submittedData: jsonb('submitted_data'),

		/** Auteur de la décision, parmi les comptes internes. */
		reviewedBy: text('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

		/** Commentaire interne, jamais transmis au client (R13). */
		reviewNotes: text('review_notes'),
		/** Motif communiqué au client en cas de refus — obligatoire (R9). */
		rejectionReason: text('rejection_reason'),

		/**
		 * Éléments réclamés lors d'une demande de complément (§5.4).
		 *
		 * La demande reste `pending` : ce champ porte le message envoyé au
		 * client, et sa présence distingue un dossier relancé d'un dossier
		 * jamais examiné.
		 */
		infoRequestedAt: timestamp('info_requested_at', { withTimezone: true }),
		infoRequested: text('info_requested'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		// File d'attente : les dossiers en attente, les plus anciens d'abord.
		index('avr_status_created_idx').on(t.status, t.createdAt),
		index('avr_customer_idx').on(t.customerId)
	]
);

export const accountValidationRequestRelations = relations(accountValidationRequest, ({ one }) => ({
	customer: one(customer, {
		fields: [accountValidationRequest.customerId],
		references: [customer.id]
	}),
	reviewer: one(user, {
		fields: [accountValidationRequest.reviewedBy],
		references: [user.id]
	})
}));

export type AccountValidationRequest = typeof accountValidationRequest.$inferSelect;
export type NewAccountValidationRequest = typeof accountValidationRequest.$inferInsert;

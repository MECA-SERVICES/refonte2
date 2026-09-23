/**
 * Journal des échanges avec les plateformes de paiement — CDC section 20.
 *
 * Chaque message, émis ou reçu, y est consigné intégralement avec le résultat
 * du contrôle de sceau. C'est la seule trace exploitable en cas de litige sur
 * un encaissement : elle doit permettre de rejouer l'échange tel qu'il a eu
 * lieu, y compris quand le sceau était invalide — un message refusé est
 * précisément celui qu'on veut pouvoir examiner.
 */

import { boolean, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { order } from './order.schema';

/** Sens de l'échange, du point de vue du site. */
export type PaymentDirection = 'outgoing' | 'incoming';

export const paymentTransaction = pgTable(
	'payment_transaction',
	{
		id: serial('id').primaryKey(),

		/*
		 * Commande concernée.
		 *
		 * Nullable : une notification peut porter une référence inconnue
		 * (rejeu, erreur de configuration, tentative de forge). Elle doit
		 * quand même être journalisée — c'est le cas qu'on cherchera à
		 * comprendre.
		 */
		orderId: integer('order_id').references(() => order.id, { onDelete: 'set null' }),

		/** `monetico` ou `sofinco`. */
		provider: text('provider').notNull(),
		/** Référence de la commande telle que transmise à la plateforme. */
		reference: text('reference'),
		direction: text('direction').$type<PaymentDirection>().notNull(),

		/** Contenu intégral de l'échange, pour pouvoir le rejouer. */
		rawPayload: text('raw_payload'),

		/*
		 * Contrôle d'intégrité.
		 *
		 * Les deux sceaux sont conservés : comparer celui qu'on attendait à
		 * celui reçu est le seul moyen de diagnostiquer une clé erronée ou un
		 * champ mal assemblé.
		 */
		signatureReceived: text('signature_received'),
		signatureExpected: text('signature_expected'),
		signatureValid: boolean('signature_valid'),

		/** Résultat renvoyé par la plateforme. */
		returnCode: text('return_code'),
		refusalReason: text('refusal_reason'),
		/** Numéro d'autorisation bancaire, preuve de l'encaissement. */
		authNumber: text('auth_number'),

		/** Contexte technique de l'appel. */
		httpStatus: integer('http_status'),
		remoteIp: text('remote_ip'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('payment_transaction_order_idx').on(t.orderId),
		index('payment_transaction_reference_idx').on(t.reference),
		// Journal consulté du plus récent au plus ancien.
		index('payment_transaction_created_idx').on(t.createdAt)
	]
);

export const paymentTransactionRelations = relations(paymentTransaction, ({ one }) => ({
	order: one(order, {
		fields: [paymentTransaction.orderId],
		references: [order.id]
	})
}));

export type PaymentTransaction = typeof paymentTransaction.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransaction.$inferInsert;

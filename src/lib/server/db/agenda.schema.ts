/**
 * Agenda de Dolibarr, repris en archive (rendez-vous, déplacements, tâches de
 * 2021 et 2022) : il n'est plus tenu depuis.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { customer } from './customer.schema';

export const agendaEvent = pgTable(
	'agenda_event',
	{
		id: serial('id').primaryKey(),
		/** Rendez-vous, intervention, autre. */
		kind: text('kind').notNull(),
		title: text('title').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }),
		allDay: boolean('all_day').notNull().default(false),
		location: text('location'),
		note: text('note'),
		customerId: integer('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		/** Qui l'a noté (nom). */
		ownerName: text('owner_name'),
		/** Reprise Dolibarr : `llx_actioncomm.id`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('agenda_event_starts_idx').on(t.startsAt),
		uniqueIndex('agenda_event_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type AgendaEvent = typeof agendaEvent.$inferSelect;

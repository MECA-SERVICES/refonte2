/**
 * Congés de l'équipe (module Congés de Dolibarr) : demandes, soldes par type,
 * et journal de chaque mouvement de solde.
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
import type { BalanceType, LeaveStatus, LeaveType } from '$lib/leaves';
import { user } from './auth.schema';

export const leaveRequest = pgTable(
	'leave_request',
	{
		id: serial('id').primaryKey(),
		/** `HL2610-0170`, dans la série Dolibarr. */
		reference: text('reference').notNull(),
		/** Compte du salarié ; null pour un ancien salarié repris de Dolibarr. */
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		/** Nom du salarié, gardé même sans compte. */
		employeeName: text('employee_name').notNull(),
		type: text('type').$type<LeaveType>().notNull(),
		startOn: date('start_on', { mode: 'string' }).notNull(),
		endOn: date('end_on', { mode: 'string' }).notNull(),
		/** Le premier jour ne compte que l'après-midi. */
		startsAfternoon: boolean('starts_afternoon').notNull().default(false),
		/** Le dernier jour ne compte que le matin. */
		endsAtNoon: boolean('ends_at_noon').notNull().default(false),
		/** Jours ouvrés décomptés. */
		days: numeric('days', { precision: 6, scale: 2 }).notNull(),
		status: text('status').$type<LeaveStatus>().notNull().default('pending'),
		description: text('description'),
		/** Motif du refus ou de l'annulation. */
		decisionNote: text('decision_note'),
		decidedBy: text('decided_by'),
		decidedAt: timestamp('decided_at', { withTimezone: true }),
		/** Reprise Dolibarr : `llx_holiday.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('leave_request_reference_idx').on(t.reference),
		index('leave_request_user_idx').on(t.userId),
		index('leave_request_status_idx').on(t.status, t.startOn),
		uniqueIndex('leave_request_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

/** Solde d'un salarié pour un type de congé, acquis chaque mois. */
export const leaveBalance = pgTable(
	'leave_balance',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').$type<BalanceType>().notNull(),
		days: numeric('days', { precision: 8, scale: 3 }).notNull().default('0'),
		/** Dernier mois acquis (`AAAA-MM`) : l'acquisition reprend au mois suivant. */
		accruedThrough: text('accrued_through').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('leave_balance_user_type_idx').on(t.userId, t.type)]
);

/** Journal des soldes : acquisition, congé approuvé ou annulé, correction. */
export const leaveBalanceLog = pgTable(
	'leave_balance_log',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		employeeName: text('employee_name').notNull(),
		type: text('type').$type<LeaveType>().notNull(),
		previousDays: numeric('previous_days', { precision: 8, scale: 3 }),
		newDays: numeric('new_days', { precision: 8, scale: 3 }),
		reason: text('reason').notNull(),
		/** Qui a fait le mouvement (nom), vide pour l'acquisition automatique. */
		actorName: text('actor_name'),
		/** Reprise Dolibarr : `llx_holiday_logs.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('leave_balance_log_user_idx').on(t.userId, t.createdAt),
		uniqueIndex('leave_balance_log_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type LeaveRequest = typeof leaveRequest.$inferSelect;
export type LeaveBalance = typeof leaveBalance.$inferSelect;

/**
 * Service client — CDC section 27.
 *
 * Deux familles de tables :
 *
 *  - `support_*` : le système vivant, où l'équipe et les clients écrivent ;
 *  - `legacy_support_*` : l'historique repris de PrestaShop (module
 *    wkhelpdesk, SAV natif, commentaires de commande), en lecture seule.
 *
 * Les deux partagent les mêmes séquences d'identifiants, et les vues
 * `support_thread_all` / `support_message_all` les réunissent : l'écran
 * affiche un seul historique, sans distinguer l'origine d'une conversation.
 * Toute écriture passe par les tables `support_*`.
 */

import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgTable,
	pgView,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { customer } from './customer.schema';
import { order } from './order.schema';

export const SUPPORT_STATUSES = ['open', 'pending_staff', 'pending_customer', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

/** Auteur d'un message ; `internal_note` n'est jamais montré au client (R13). */
export const SUPPORT_SENDER_TYPES = ['customer', 'staff', 'internal_note'] as const;
export type SupportSenderType = (typeof SUPPORT_SENDER_TYPES)[number];

/** Nature d'une entrée du fil, historique compris (`status_change`). */
export type SupportMessageKind = SupportSenderType | 'status_change';

/** Origine d'une conversation de l'historique. */
export type LegacySupportSource = 'wkhelpdesk' | 'ps_thread' | 'ps_message';

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

/** Catégories de demande, gérées depuis le back-office. */
export const supportCategory = pgTable(
	'support_category',
	{
		id: serial('id').primaryKey(),
		/** Code stable : sert à la reprise et aux filtres d'URL. */
		code: text('code').notNull(),
		label: text('label').notNull(),
		position: integer('position').notNull().default(0),
		/**
		 * Une catégorie déjà utilisée se désactive : la supprimer orphelinerait
		 * les conversations qui la portent.
		 */
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('support_category_code_idx').on(t.code)]
);

// ---------------------------------------------------------------------------
// Système vivant
// ---------------------------------------------------------------------------

export const supportThread = pgTable(
	'support_thread',
	{
		id: serial('id').primaryKey(),
		/** Référence communiquée au client (accusé de réception). */
		reference: text('reference').notNull(),
		customerId: integer('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		/** Demandeur non authentifié (R1). */
		guestEmail: text('guest_email'),
		guestName: text('guest_name'),
		subject: text('subject').notNull(),
		status: text('status').$type<SupportStatus>().notNull().default('open'),
		categoryId: integer('category_id').references(() => supportCategory.id, {
			onDelete: 'restrict'
		}),
		priority: text('priority').$type<SupportPriority>().notNull().default('normal'),
		orderId: integer('order_id').references(() => order.id, { onDelete: 'set null' }),
		assignedUserId: text('assigned_user_id').references(() => user.id, { onDelete: 'set null' }),
		unreadByStaff: integer('unread_by_staff').notNull().default(0),
		unreadByCustomer: integer('unread_by_customer').notNull().default(0),
		/** Tri par défaut de la liste (R7). */
		lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
		/**
		 * Conversation dont celle-ci est la suite. Une conversation de
		 * l'historique ne se rouvre pas : y répondre en ouvre une nouvelle.
		 * Sans clé étrangère, l'identifiant pouvant désigner l'une ou l'autre
		 * table (séquence commune).
		 */
		continuesThreadId: integer('continues_thread_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		closedAt: timestamp('closed_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('support_thread_reference_idx').on(t.reference),
		index('support_thread_status_last_idx').on(t.status, t.lastMessageAt.desc()),
		index('support_thread_customer_idx').on(t.customerId),
		index('support_thread_order_idx').on(t.orderId),
		index('support_thread_assigned_idx').on(t.assignedUserId),
		index('support_thread_category_idx').on(t.categoryId),
		index('support_thread_guest_email_idx').on(sql`lower(${t.guestEmail})`)
	]
);

export const supportMessage = pgTable(
	'support_message',
	{
		id: serial('id').primaryKey(),
		threadId: integer('thread_id')
			.notNull()
			.references(() => supportThread.id, { onDelete: 'cascade' }),
		senderType: text('sender_type').$type<SupportSenderType>().notNull(),
		/** Auteur côté équipe ; nul pour un message du client. */
		senderUserId: text('sender_user_id').references(() => user.id, { onDelete: 'set null' }),
		/** Un message envoyé n'est jamais modifié (R8). */
		content: text('content').notNull(),
		readAt: timestamp('read_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('support_message_thread_idx').on(t.threadId, t.createdAt)]
);

export const supportAttachment = pgTable(
	'support_attachment',
	{
		id: serial('id').primaryKey(),
		messageId: integer('message_id')
			.notNull()
			.references(() => supportMessage.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		contentType: text('content_type'),
		sizeBytes: integer('size_bytes'),
		/** Clé de l'objet sur le stockage (Cloudflare R2, à venir). */
		storageKey: text('storage_key'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('support_attachment_message_idx').on(t.messageId)]
);

// ---------------------------------------------------------------------------
// Historique PrestaShop — lecture seule
// ---------------------------------------------------------------------------

export const legacySupportThread = pgTable(
	'legacy_support_thread',
	{
		/** Même séquence que `support_thread` : les numéros ne se recouvrent pas. */
		id: integer('id')
			.primaryKey()
			.default(sql`nextval('support_thread_id_seq')`),
		source: text('source').$type<LegacySupportSource>().notNull(),
		legacyPsId: integer('legacy_ps_id').notNull(),
		reference: text('reference').notNull(),
		customerId: integer('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		guestEmail: text('guest_email'),
		guestName: text('guest_name'),
		subject: text('subject').notNull(),
		categoryId: integer('category_id').references(() => supportCategory.id, {
			onDelete: 'set null'
		}),
		/** Statut tel qu'il était dans PrestaShop (`answered`, `resolved`…). */
		legacyStatus: text('legacy_status'),
		orderId: integer('order_id').references(() => order.id, { onDelete: 'set null' }),
		/** Dernier membre de l'équipe à avoir écrit, nom figé à la reprise. */
		lastAgentName: text('last_agent_name'),
		messageCount: integer('message_count').notNull().default(0),
		openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
		lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
		importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('legacy_support_thread_source_idx').on(t.source, t.legacyPsId),
		uniqueIndex('legacy_support_thread_reference_idx').on(t.reference),
		index('legacy_support_thread_customer_idx').on(t.customerId),
		index('legacy_support_thread_order_idx').on(t.orderId),
		index('legacy_support_thread_last_idx').on(t.lastMessageAt.desc()),
		index('legacy_support_thread_category_idx').on(t.categoryId),
		index('legacy_support_thread_guest_email_idx').on(sql`lower(${t.guestEmail})`)
	]
);

export const legacySupportMessage = pgTable(
	'legacy_support_message',
	{
		id: integer('id')
			.primaryKey()
			.default(sql`nextval('support_message_id_seq')`),
		threadId: integer('thread_id')
			.notNull()
			.references(() => legacySupportThread.id, { onDelete: 'cascade' }),
		/** `status_change` : changement de statut, pour savoir qui a traité. */
		kind: text('kind').$type<SupportMessageKind>().notNull(),
		/** Nom de l'auteur tel qu'il figurait dans PrestaShop. */
		authorName: text('author_name'),
		content: text('content').notNull().default(''),
		statusFrom: text('status_from'),
		statusTo: text('status_to'),
		legacyPsId: integer('legacy_ps_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(t) => [
		uniqueIndex('legacy_support_message_source_idx').on(t.threadId, t.legacyPsId),
		index('legacy_support_message_thread_idx').on(t.threadId, t.createdAt)
	]
);

/**
 * Trace des pièces jointes de l'historique. Les fichiers restent sur l'ancien
 * serveur pour l'instant : `storageKey` sera renseignée lors du transfert.
 */
export const legacySupportAttachment = pgTable(
	'legacy_support_attachment',
	{
		id: integer('id')
			.primaryKey()
			.default(sql`nextval('support_attachment_id_seq')`),
		messageId: integer('message_id')
			.notNull()
			.references(() => legacySupportMessage.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		/** Chemin relatif à la racine PrestaShop (`modules/wkhelpdesk/…`, `upload/…`). */
		legacyPath: text('legacy_path').notNull(),
		storageKey: text('storage_key')
	},
	(t) => [index('legacy_support_attachment_message_idx').on(t.messageId)]
);

// ---------------------------------------------------------------------------
// Lecture unifiée (vues définies dans la migration 0036)
// ---------------------------------------------------------------------------

/**
 * Toutes les conversations, système vivant et historique confondus.
 * `isLegacy` reste interne : il sert à refuser l'écriture, jamais à l'afficher.
 */
export const supportThreadAll = pgView('support_thread_all', {
	id: integer('id').notNull(),
	reference: text('reference').notNull(),
	customerId: integer('customer_id'),
	guestEmail: text('guest_email'),
	guestName: text('guest_name'),
	subject: text('subject').notNull(),
	status: text('status').$type<SupportStatus>().notNull(),
	categoryId: integer('category_id'),
	priority: text('priority').$type<SupportPriority>().notNull(),
	orderId: integer('order_id'),
	assignedUserId: text('assigned_user_id'),
	unreadByStaff: integer('unread_by_staff').notNull(),
	unreadByCustomer: integer('unread_by_customer').notNull(),
	lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
	continuesThreadId: integer('continues_thread_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	closedAt: timestamp('closed_at', { withTimezone: true }),
	lastAgentName: text('last_agent_name'),
	isLegacy: boolean('is_legacy').notNull()
}).existing();

/** Tous les messages, système vivant et historique confondus. */
export const supportMessageAll = pgView('support_message_all', {
	id: integer('id').notNull(),
	threadId: integer('thread_id').notNull(),
	kind: text('kind').$type<SupportMessageKind>().notNull(),
	senderUserId: text('sender_user_id'),
	authorName: text('author_name'),
	content: text('content').notNull(),
	statusFrom: text('status_from'),
	statusTo: text('status_to'),
	readAt: timestamp('read_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	isLegacy: boolean('is_legacy').notNull()
}).existing();

// ---------------------------------------------------------------------------
// Relations Drizzle
// ---------------------------------------------------------------------------

export const supportThreadRelations = relations(supportThread, ({ one, many }) => ({
	customer: one(customer, { fields: [supportThread.customerId], references: [customer.id] }),
	order: one(order, { fields: [supportThread.orderId], references: [order.id] }),
	category: one(supportCategory, {
		fields: [supportThread.categoryId],
		references: [supportCategory.id]
	}),
	assignedUser: one(user, { fields: [supportThread.assignedUserId], references: [user.id] }),
	messages: many(supportMessage)
}));

export const supportMessageRelations = relations(supportMessage, ({ one, many }) => ({
	thread: one(supportThread, { fields: [supportMessage.threadId], references: [supportThread.id] }),
	attachments: many(supportAttachment)
}));

export const supportAttachmentRelations = relations(supportAttachment, ({ one }) => ({
	message: one(supportMessage, {
		fields: [supportAttachment.messageId],
		references: [supportMessage.id]
	})
}));

export const legacySupportThreadRelations = relations(legacySupportThread, ({ many }) => ({
	messages: many(legacySupportMessage)
}));

export const legacySupportMessageRelations = relations(legacySupportMessage, ({ one, many }) => ({
	thread: one(legacySupportThread, {
		fields: [legacySupportMessage.threadId],
		references: [legacySupportThread.id]
	}),
	attachments: many(legacySupportAttachment)
}));

export const legacySupportAttachmentRelations = relations(legacySupportAttachment, ({ one }) => ({
	message: one(legacySupportMessage, {
		fields: [legacySupportAttachment.messageId],
		references: [legacySupportMessage.id]
	})
}));

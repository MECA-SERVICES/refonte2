/**
 * Ordres de réparation atelier — CDC section 31.
 *
 * Pilote l'exécution des travaux : main-d'œuvre, pièces consommées, suivi de
 * l'avancement, restitution de la machine.
 *
 * Le CDC rattache cette section aux demandes de réparation (section 30), mais
 * prévoit explicitement une seconde voie : « un ordre peut également être créé
 * directement par l'atelier, pour une intervention au comptoir sans demande
 * préalable ». C'est cette voie qui est implémentée ici — d'où
 * `repairRequestId` et `quoteId` laissés nullables, en attente de la section 30.
 *
 * Aucun devis n'est jamais émis depuis un ordre (R4) : le chiffrage relève de
 * la demande. C'est ce qui rend cette section autonome.
 */

import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	numeric,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { customer } from './customer.schema';
import { product } from './catalog.schema';
import type { RepairImageMoment, RepairOrderType, RepairStatus } from '$lib/repairs';

/**
 * Les énumérations du domaine vivent dans `$lib/repairs`, accessible au
 * navigateur : ce fichier est réservé au serveur et ne peut pas les lui
 * fournir. Réexportées ici pour que le schéma reste lisible d'un bloc.
 */
export { repairImageMoments, repairOrderTypes, repairStatuses } from '$lib/repairs';
export type { RepairImageMoment, RepairOrderType, RepairStatus } from '$lib/repairs';

export const repairOrder = pgTable(
	'repair_order',
	{
		id: serial('id').primaryKey(),

		/** Référence unique communiquée au client (R1). */
		reference: text('reference').notNull(),

		/** Client propriétaire de la machine. Un ordre vise toujours un client
		 *  existant (R2). */
		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'restrict' }),

		/*
		 * Origine de l'ordre, quand il vient d'une demande (section 30).
		 * Aucune contrainte de clé étrangère : les tables `repair_request` et
		 * `quote` n'existent pas encore. Les identifiants sont conservés pour
		 * que la section 30 s'y branche sans migration de données.
		 */
		repairRequestId: integer('repair_request_id'),
		quoteId: integer('quote_id'),

		status: text('status').$type<RepairStatus>().notNull().default('to_do'),
		orderType: text('order_type').$type<RepairOrderType>().notNull().default('paid'),

		/** Référence et justificatif du dossier de garantie (R14). */
		warrantyReference: text('warranty_reference'),
		warrantyDocumentUrl: text('warranty_document_url'),

		/** Identification de la machine prise en charge. */
		machineType: text('machine_type'),
		machineBrand: text('machine_brand'),
		machineModel: text('machine_model'),
		serialNumber: text('serial_number'),
		/** État constaté à la prise en charge. */
		machineCondition: text('machine_condition'),
		engineModel: text('engine_model'),
		engineSerialNumber: text('engine_serial_number'),

		/** Travaux réalisés — obligatoire avant l'achèvement (R12). */
		workDescription: text('work_description'),

		/*
		 * Suspension en attente d'une pièce (R13).
		 *
		 * Le CDC exige d'indiquer « la pièce attendue et la date prévue » sans
		 * prévoir de champ pour les porter : ces deux colonnes comblent ce
		 * manque.
		 */
		onHoldPartLabel: text('on_hold_part_label'),
		onHoldExpectedAt: timestamp('on_hold_expected_at', { withTimezone: true }),

		/** Frais de diagnostic, repris du devis accepté le cas échéant. */
		diagnosticFee: numeric('diagnostic_fee', { precision: 12, scale: 2 }).notNull().default('0'),
		/** Main-d'œuvre. */
		laborAmount: numeric('labor_amount', { precision: 12, scale: 2 }).notNull().default('0'),

		/** Totaux, recalculés à chaque modification (R11). */
		totalPartsHt: numeric('total_parts_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
		totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),

		/*
		 * Facture émise à l'achèvement (R18).
		 *
		 * Volontairement non branché pour l'instant : la numérotation légale des
		 * factures d'atelier reste à arbitrer. La colonne est posée pour que le
		 * rattachement se fasse plus tard sans toucher aux données.
		 */
		invoiceId: integer('invoice_id'),

		/** Note visible du client. */
		notes: text('notes'),
		/** Note interne, jamais exposée ni portée sur un document (R23). */
		privateNote: text('private_note'),

		/** Machine versée au parc du client à la restitution (R21). */
		machineAddedToFleet: boolean('machine_added_to_fleet').notNull().default(false),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		deliveredAt: timestamp('delivered_at', { withTimezone: true }),
		paidAt: timestamp('paid_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('repair_order_reference_idx').on(t.reference),
		index('repair_order_customer_idx').on(t.customerId),
		index('repair_order_status_idx').on(t.status)
	]
);

export const repairOrderPart = pgTable(
	'repair_order_part',
	{
		id: serial('id').primaryKey(),
		repairOrderId: integer('repair_order_id')
			.notNull()
			.references(() => repairOrder.id, { onDelete: 'cascade' }),

		/*
		 * Article du catalogue, le cas échéant (R5).
		 *
		 * C'est ce lien qui distingue une pièce du stock — dont la consommation
		 * décrémente l'inventaire (R6) — d'une pièce saisie librement, qui n'y
		 * touche pas. `onDelete: 'set null'` : supprimer un produit du catalogue
		 * ne doit pas effacer l'historique d'une intervention.
		 */
		productId: integer('product_id').references(() => product.id, { onDelete: 'set null' }),

		partName: text('part_name').notNull(),
		partReference: text('part_reference'),
		quantity: integer('quantity').notNull().default(1),
		unitPriceHt: numeric('unit_price_ht', { precision: 12, scale: 2 }).notNull().default('0'),
		totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('repair_order_part_order_idx').on(t.repairOrderId)]
);

export const repairOrderImage = pgTable(
	'repair_order_image',
	{
		id: serial('id').primaryKey(),
		repairOrderId: integer('repair_order_id')
			.notNull()
			.references(() => repairOrder.id, { onDelete: 'cascade' }),

		url: text('url').notNull(),
		label: text('label'),
		/** `before` documente l'état à la prise en charge, `after` le travail
		 *  réalisé (R22). */
		moment: text('moment').$type<RepairImageMoment>().notNull(),
		position: integer('position').notNull().default(0),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('repair_order_image_order_idx').on(t.repairOrderId)]
);

export const repairOrderRelations = relations(repairOrder, ({ one, many }) => ({
	customer: one(customer, {
		fields: [repairOrder.customerId],
		references: [customer.id]
	}),
	parts: many(repairOrderPart),
	images: many(repairOrderImage)
}));

export const repairOrderPartRelations = relations(repairOrderPart, ({ one }) => ({
	repairOrder: one(repairOrder, {
		fields: [repairOrderPart.repairOrderId],
		references: [repairOrder.id]
	}),
	product: one(product, {
		fields: [repairOrderPart.productId],
		references: [product.id]
	})
}));

export const repairOrderImageRelations = relations(repairOrderImage, ({ one }) => ({
	repairOrder: one(repairOrder, {
		fields: [repairOrderImage.repairOrderId],
		references: [repairOrder.id]
	})
}));

export type RepairOrder = typeof repairOrder.$inferSelect;
export type NewRepairOrder = typeof repairOrder.$inferInsert;
export type RepairOrderPart = typeof repairOrderPart.$inferSelect;
export type RepairOrderImage = typeof repairOrderImage.$inferSelect;

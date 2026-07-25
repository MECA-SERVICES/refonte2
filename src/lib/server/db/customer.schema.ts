import {
	pgTable,
	serial,
	integer,
	text,
	varchar,
	boolean,
	numeric,
	timestamp,
	index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth.schema';

/**
 * Domaine « Fondations » — données métier des clients.
 *
 * L'authentification (email, mot de passe, sessions, rôle) est portée par la
 * table `user` de better-auth. `customer` porte uniquement les informations
 * e-commerce, en relation 1-1 avec `user`. Seuls les clients ont une ligne ici ;
 * le personnel (role employee/admin) n'en a pas.
 */

/** Type de compte client. */
export const customerType = ['particulier', 'entreprise', 'collectivite'] as const;
export type CustomerType = (typeof customerType)[number];

/** État de validation du compte (utile pour les comptes pro à valider). */
export const customerStatus = ['pending', 'validated', 'rejected'] as const;
export type CustomerStatus = (typeof customerStatus)[number];

export const customer = pgTable(
	'customer',
	{
		id: serial('id').primaryKey(),

		// Lien 1-1 vers l'identité better-auth.
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
			.unique(),

		// Identité
		firstName: text('first_name').notNull(),
		lastName: text('last_name').notNull(),
		email: text('email').notNull(),
		phone: text('phone'),

		// Type & statut de compte
		type: text('type').notNull().default('particulier'),
		status: text('status').notNull().default('validated'),

		// Informations entreprise (B2B)
		companyName: varchar('company_name', { length: 255 }),
		siret: varchar('siret', { length: 14 }),
		vatNumber: varchar('vat_number', { length: 20 }),
		taxExemptStatus: text('tax_exempt_status').default('standard'),

		// Collectivités
		collectivityType: text('collectivity_type'),
		collectivityName: text('collectivity_name'),

		// Document KBIS (validation pro)
		kbisDocumentId: integer('kbis_document_id'),
		kbisValidatedAt: timestamp('kbis_validated_at', { withTimezone: true }),

		// Facturation / divers
		invoiceFormat: text('invoice_format').notNull().default('standard'),
		totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).notNull().default('0'),
		source: text('source').default('direct'),
		privateNote: text('private_note'),

		// Newsletter
		newsletterSubscribed: boolean('newsletter_subscribed').notNull().default(false),
		newsletterSubscribedAt: timestamp('newsletter_subscribed_at', { withTimezone: true }),

		// Traçabilité de la reprise PrestaShop (renseignée par l'import des données).
		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		// Tri par défaut de la liste admin (plus récents d'abord).
		index('customer_created_at_idx').on(t.createdAt),
		// Index trigram : la recherche globale fait un OR de ILIKE '%terme%' sur toutes
		// ces colonnes — il faut TOUTES les indexer pour que Postgres évite le scan complet.
		index('customer_first_name_trgm_idx').using('gin', t.firstName.op('gin_trgm_ops')),
		index('customer_last_name_trgm_idx').using('gin', t.lastName.op('gin_trgm_ops')),
		index('customer_email_trgm_idx').using('gin', t.email.op('gin_trgm_ops')),
		index('customer_phone_trgm_idx').using('gin', t.phone.op('gin_trgm_ops')),
		index('customer_company_trgm_idx').using('gin', t.companyName.op('gin_trgm_ops')),
		index('customer_siret_trgm_idx').using('gin', t.siret.op('gin_trgm_ops')),
		index('customer_vat_trgm_idx').using('gin', t.vatNumber.op('gin_trgm_ops'))
	]
);

/**
 * Carnet d'adresses d'un client (livraison / facturation), en relation 1-N.
 */
export const address = pgTable(
	'address',
	{
		id: serial('id').primaryKey(),

		customerId: integer('customer_id')
			.notNull()
			.references(() => customer.id, { onDelete: 'cascade' }),

		label: text('label'),

		firstName: text('first_name').notNull(),
		lastName: text('last_name').notNull(),
		company: text('company'),

		line1: text('line1').notNull(),
		line2: text('line2'),
		city: text('city').notNull(),
		postalCode: text('postal_code').notNull(),
		country: text('country').notNull().default('FR'),
		phone: text('phone'),

		isDefaultShipping: boolean('is_default_shipping').notNull().default(false),
		isDefaultBilling: boolean('is_default_billing').notNull().default(false),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		// Jointure carnet d'adresses d'un client + tri par défaut de la liste globale.
		index('address_customer_idx').on(t.customerId),
		index('address_created_at_idx').on(t.createdAt),
		// Recherche globale des adresses (OR de ILIKE sur ces 4 colonnes).
		index('address_first_name_trgm_idx').using('gin', t.firstName.op('gin_trgm_ops')),
		index('address_last_name_trgm_idx').using('gin', t.lastName.op('gin_trgm_ops')),
		index('address_city_trgm_idx').using('gin', t.city.op('gin_trgm_ops')),
		index('address_postal_code_trgm_idx').using('gin', t.postalCode.op('gin_trgm_ops'))
	]
);

// Relations (pour l'API relationnelle de Drizzle)
export const customerRelations = relations(customer, ({ one, many }) => ({
	user: one(user, { fields: [customer.userId], references: [user.id] }),
	addresses: many(address)
}));

export const addressRelations = relations(address, ({ one }) => ({
	customer: one(customer, { fields: [address.customerId], references: [customer.id] })
}));

export type Customer = typeof customer.$inferSelect;
export type NewCustomer = typeof customer.$inferInsert;
export type Address = typeof address.$inferSelect;
export type NewAddress = typeof address.$inferInsert;

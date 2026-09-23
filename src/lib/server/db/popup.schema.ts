/**
 * Pop-ups d'annonce de la boutique.
 *
 * Messages ponctuels adressés aux visiteurs — fermeture de l'atelier,
 * promotion, nouveauté. Distincts d'une page CMS : une pop-up s'impose au
 * visiteur, vit sur une période donnée et se referme. Elle doit donc pouvoir
 * être bornée dans le temps, ciblée, et espacée.
 */

import { boolean, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Portée de l'affichage.
 *
 * `paths` ouvre le ciblage fin ; les deux autres valeurs couvrent les cas
 * courants sans obliger à saisir une liste d'adresses.
 */
export type PopupScope = 'all' | 'home' | 'paths';

export const popup = pgTable(
	'popup',
	{
		id: serial('id').primaryKey(),

		/** Repère interne, jamais affiché au visiteur. */
		name: text('name').notNull(),

		/** Titre affiché dans la pop-up ; vide, aucun titre n'est rendu. */
		title: text('title'),

		/**
		 * Contenu HTML produit par l'éditeur, assaini à l'affichage.
		 *
		 * Stocké en HTML comme les pages CMS : le contenu reste lisible même si
		 * l'outil de rédaction change.
		 */
		content: text('content').notNull().default(''),

		imageUrl: text('image_url'),

		/** Bouton d'action ; sans libellé ni adresse, aucun bouton n'est rendu. */
		ctaLabel: text('cta_label'),
		ctaUrl: text('cta_url'),

		/** Une pop-up inactive ne s'affiche jamais, quelles que soient ses dates. */
		isActive: boolean('is_active').notNull().default(false),

		/*
		 * Fenêtre de diffusion.
		 *
		 * Les deux bornes sont facultatives : sans date de fin, la pop-up court
		 * jusqu'à désactivation — c'est le cas d'une information permanente.
		 */
		startsAt: timestamp('starts_at', { withTimezone: true }),
		endsAt: timestamp('ends_at', { withTimezone: true }),

		/** `all`, `home` ou `paths` — voir `PopupScope`. */
		scope: text('scope').$type<PopupScope>().notNull().default('all'),

		/**
		 * Adresses ciblées quand `scope` vaut `paths`, une par ligne.
		 *
		 * Un chemin terminé par `*` couvre tout ce qui commence par lui :
		 * `/blog*` vise le blog entier.
		 */
		paths: text('paths'),

		/** Délai avant apparition, en secondes. */
		delaySeconds: integer('delay_seconds').notNull().default(0),

		/**
		 * Durée de silence après fermeture, en jours.
		 *
		 * Mémorisée dans le navigateur du visiteur : `0` réaffiche à chaque
		 * visite, ce qui n'a de sens que pour une annonce très brève.
		 */
		dismissDays: integer('dismiss_days').notNull().default(7),

		/** Ordre de priorité si plusieurs pop-ups sont éligibles ; la plus haute gagne. */
		priority: integer('priority').notNull().default(0),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		// Sélection publique : les actives, triées par priorité.
		index('popup_active_idx').on(t.isActive, t.priority),
		index('popup_window_idx').on(t.startsAt, t.endsAt)
	]
);

export type Popup = typeof popup.$inferSelect;
export type NewPopup = typeof popup.$inferInsert;

/**
 * Libellés du service client, partagés entre le back-office et l'espace
 * client. Sans accès base : importable côté navigateur.
 */

import type { SupportPriority, SupportStatus } from '$lib/server/db/support.schema';

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
	open: 'Ouverte',
	pending_staff: 'À traiter',
	pending_customer: 'En attente du client',
	closed: 'Clôturée'
};

/** Couleurs des pastilles d'état, au format attendu par `StateBadge`. */
export const SUPPORT_STATUS_COLORS: Record<SupportStatus, string> = {
	open: '#2563eb',
	pending_staff: '#e31d27',
	pending_customer: '#d97706',
	closed: '#6b7280'
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
	low: 'Basse',
	normal: 'Normale',
	high: 'Haute',
	urgent: 'Urgente'
};

/**
 * Statuts rencontrés dans l'historique des conversations (changements de
 * statut tracés par l'ancien outil de tickets).
 */
export const HISTORY_STATUS_LABELS: Record<string, string> = {
	open: 'Ouvert',
	closed: 'Clôturé',
	answered: 'Répondu',
	pending: 'En attente',
	resolved: 'Résolu',
	spam: 'Spam'
};

/** Auteur affiché quand le membre de l'équipe n'est plus identifiable. */
export const TEAM_FALLBACK_NAME = 'Équipe MS Shop';

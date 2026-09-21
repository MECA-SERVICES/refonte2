/**
 * Vocabulaire partagé des comptes clients — CDC section 08.
 *
 * Lu aussi bien par le navigateur que par le serveur ; `$lib/server/accounts`
 * garde les accès à la base et réexporte ce qui suit, sur le modèle de
 * `$lib/repairs`.
 *
 * ## Pourquoi une normalisation
 *
 * Trois vocabulaires ont coexisté pour `customer.type` et `customer.status` :
 * la reprise PrestaShop (`individual`/`professional`, `active`/`inactive`),
 * une première version du schéma (`entreprise`) et le CDC (`pro`). Les valeurs
 * de référence sont celles du CDC ; `normalizeCustomerType` et
 * `normalizeCustomerStatus` ramènent les autres, pour que le code n'ait jamais
 * à connaître qu'un seul jeu.
 */

/** Typologies de compte (CDC 08, §3). */
export const CUSTOMER_TYPES = ['particulier', 'pro', 'collectivite'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

/** États de validation d'un compte (CDC 08, §3). */
export const CUSTOMER_STATUSES = ['pending', 'validated', 'rejected'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/** Types de demande ouvrant une validation (R2). */
export const VALIDATION_REQUEST_TYPES = ['pro', 'collectivite'] as const;
export type ValidationRequestType = (typeof VALIDATION_REQUEST_TYPES)[number];

/**
 * Valeurs héritées, ramenées au vocabulaire du CDC.
 *
 * Conservées même après la migration des données : un import PrestaShop rejoué
 * ou une reprise partielle réintroduirait les anciennes valeurs.
 */
const TYPE_ALIASES: Record<string, CustomerType> = {
	individual: 'particulier',
	professional: 'pro',
	entreprise: 'pro',
	company: 'pro',
	collectivity: 'collectivite'
};

const STATUS_ALIASES: Record<string, CustomerStatus> = {
	active: 'validated',
	inactive: 'rejected'
};

/** Ramène un type de compte au vocabulaire du CDC ; `particulier` par défaut. */
export function normalizeCustomerType(value?: string | null): CustomerType {
	const raw = (value ?? '').trim().toLowerCase();
	if ((CUSTOMER_TYPES as readonly string[]).includes(raw)) return raw as CustomerType;
	return TYPE_ALIASES[raw] ?? 'particulier';
}

/** Ramène un statut au vocabulaire du CDC ; `pending` par défaut. */
export function normalizeCustomerStatus(value?: string | null): CustomerStatus {
	const raw = (value ?? '').trim().toLowerCase();
	if ((CUSTOMER_STATUSES as readonly string[]).includes(raw)) return raw as CustomerStatus;
	return STATUS_ALIASES[raw] ?? 'pending';
}

/** Professionnels et collectivités partagent le même traitement (R14). */
export function isBusinessType(value?: string | null): boolean {
	const type = normalizeCustomerType(value);
	return type === 'pro' || type === 'collectivite';
}

/**
 * Un compte non particulier doit être validé avant d'ouvrir ses conditions
 * (R1, R2) : lui seul entre dans la file d'attente du back-office.
 */
export function requiresValidation(value?: string | null): boolean {
	return isBusinessType(value);
}

/** Libellés d'affichage. */
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
	particulier: 'Particulier',
	pro: 'Professionnel',
	collectivite: 'Collectivité'
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
	pending: 'En attente',
	validated: 'Validé',
	rejected: 'Refusé'
};

/** Couleurs de badge, alignées sur les conventions de l'admin. */
export const CUSTOMER_STATUS_COLORS = {
	pending: 'yellow',
	validated: 'green',
	rejected: 'red'
} as const satisfies Record<CustomerStatus, string>;

/** Décisions possibles sur une demande (CDC 08, §5.4). */
export const VALIDATION_DECISIONS = ['validate', 'reject', 'request_info'] as const;
export type ValidationDecision = (typeof VALIDATION_DECISIONS)[number];

export const VALIDATION_DECISION_LABELS: Record<ValidationDecision, string> = {
	validate: 'Valider',
	reject: 'Refuser',
	request_info: 'Demander un complément'
};

/** Nombre de demandes par page dans la file d'attente. */
export const VALIDATIONS_PER_PAGE = 20;

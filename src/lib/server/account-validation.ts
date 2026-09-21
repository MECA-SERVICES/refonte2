/**
 * Validation des comptes professionnels et collectivités — CDC section 08.
 *
 * Une demande est ouverte à chaque soumission de dossier (R2) ; le back-office
 * la valide, la refuse avec motif (R9) ou réclame un complément (§5.4). Le
 * `status` de la fiche client reflète toujours la décision de la demande la
 * plus récente.
 *
 * Toutes les décisions passent par `decideValidationRequest` : jamais par une
 * écriture directe du statut, sur le modèle de `changeRepairStatus` (CDC 31).
 */

import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from './db';
import { accountValidationRequest, customer } from './db/schema';
import { user } from './db/auth.schema';
import {
	normalizeCustomerStatus,
	normalizeCustomerType,
	requiresValidation,
	VALIDATIONS_PER_PAGE,
	type CustomerStatus,
	type ValidationDecision,
	type ValidationRequestType
} from '$lib/accounts';

export { normalizeCustomerStatus, normalizeCustomerType, requiresValidation, VALIDATIONS_PER_PAGE };

/** Erreur métier de la validation, distinguée des pannes techniques. */
export class ValidationError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Informations figées au moment de la soumission (R2). */
export type SubmittedData = {
	companyName?: string | null;
	siret?: string | null;
	vatNumber?: string | null;
	collectivityType?: string | null;
	collectivityName?: string | null;
	origin?: string;
};

/**
 * Ouvre une demande de validation pour un client.
 *
 * Appelée à l'inscription (R2) et à chaque resoumission après refus (R10) :
 * l'historique est conservé, une nouvelle ligne est créée à chaque fois.
 */
export async function openValidationRequest(
	customerId: number,
	requestType: ValidationRequestType,
	submittedData: SubmittedData,
	runner: Tx | typeof db = db
) {
	const [row] = await runner
		.insert(accountValidationRequest)
		.values({ customerId, requestType, status: 'pending', submittedData })
		.returning();
	return row;
}

/**
 * Demande en cours d'un client, s'il en a une.
 *
 * Il ne peut y en avoir qu'une à la fois : une resoumission n'est ouverte
 * qu'après une décision.
 */
export async function pendingRequestForCustomer(customerId: number) {
	const [row] = await db
		.select()
		.from(accountValidationRequest)
		.where(
			and(
				eq(accountValidationRequest.customerId, customerId),
				eq(accountValidationRequest.status, 'pending')
			)
		)
		.orderBy(desc(accountValidationRequest.createdAt))
		.limit(1);
	return row;
}

/** Historique complet des demandes d'un client, la plus récente d'abord. */
export function listRequestsForCustomer(customerId: number) {
	return db
		.select()
		.from(accountValidationRequest)
		.where(eq(accountValidationRequest.customerId, customerId))
		.orderBy(desc(accountValidationRequest.createdAt));
}

export type ValidationListParams = {
	status?: CustomerStatus;
	requestType?: ValidationRequestType;
	search?: string;
	page?: number;
};

/**
 * File d'attente du back-office (§5.4).
 *
 * Les dossiers en attente sont présentés du plus ancien au plus récent : un
 * client ne doit pas attendre indéfiniment parce que d'autres arrivent.
 */
export async function listValidationRequests(params: ValidationListParams = {}) {
	const page = Math.max(1, params.page ?? 1);
	const conditions = [];

	if (params.status) conditions.push(eq(accountValidationRequest.status, params.status));
	if (params.requestType) {
		conditions.push(eq(accountValidationRequest.requestType, params.requestType));
	}

	if (params.search?.trim()) {
		const like = `%${params.search.trim()}%`;
		conditions.push(
			or(
				ilike(customer.firstName, like),
				ilike(customer.lastName, like),
				ilike(customer.email, like),
				ilike(customer.companyName, like),
				ilike(customer.siret, like),
				ilike(customer.collectivityName, like)
			)!
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			id: accountValidationRequest.id,
			customerId: accountValidationRequest.customerId,
			requestType: accountValidationRequest.requestType,
			status: accountValidationRequest.status,
			createdAt: accountValidationRequest.createdAt,
			reviewedAt: accountValidationRequest.reviewedAt,
			infoRequestedAt: accountValidationRequest.infoRequestedAt,
			firstName: customer.firstName,
			lastName: customer.lastName,
			email: customer.email,
			companyName: customer.companyName,
			siret: customer.siret,
			vatNumber: customer.vatNumber,
			collectivityName: customer.collectivityName
		})
		.from(accountValidationRequest)
		.innerJoin(customer, eq(accountValidationRequest.customerId, customer.id))
		.where(where)
		// Les plus anciens d'abord dans la file ; ailleurs, les plus récents.
		.orderBy(
			params.status === 'pending'
				? accountValidationRequest.createdAt
				: desc(accountValidationRequest.createdAt)
		)
		.limit(VALIDATIONS_PER_PAGE)
		.offset((page - 1) * VALIDATIONS_PER_PAGE);

	const [total] = await db
		.select({ n: count() })
		.from(accountValidationRequest)
		.innerJoin(customer, eq(accountValidationRequest.customerId, customer.id))
		.where(where);

	const n = Number(total?.n ?? 0);
	return {
		rows,
		total: n,
		page,
		perPage: VALIDATIONS_PER_PAGE,
		pageCount: Math.max(1, Math.ceil(n / VALIDATIONS_PER_PAGE))
	};
}

/** Compteurs par statut, pour les onglets de la file. */
export async function countByStatus() {
	const rows = await db
		.select({ status: accountValidationRequest.status, n: count() })
		.from(accountValidationRequest)
		.groupBy(accountValidationRequest.status);

	const base: Record<CustomerStatus, number> = { pending: 0, validated: 0, rejected: 0 };
	for (const row of rows) {
		const key = normalizeCustomerStatus(row.status);
		base[key] = Number(row.n);
	}
	return base;
}

/** Demande et fiche client complète, pour l'écran de détail. */
export async function getValidationRequest(id: number) {
	const [row] = await db
		.select({
			request: accountValidationRequest,
			customer,
			reviewerName: user.name
		})
		.from(accountValidationRequest)
		.innerJoin(customer, eq(accountValidationRequest.customerId, customer.id))
		.leftJoin(user, eq(accountValidationRequest.reviewedBy, user.id))
		.where(eq(accountValidationRequest.id, id))
		.limit(1);
	return row;
}

export type DecisionInput = {
	decision: ValidationDecision;
	/** Obligatoire pour un refus (R9) ou une demande de complément. */
	message?: string | null;
	/** Commentaire interne, jamais transmis (R13). */
	reviewNotes?: string | null;
	/** Compte interne auteur de la décision. */
	reviewerId?: string | null;
};

/**
 * Applique une décision à une demande (§5.4).
 *
 * Unique porte de sortie : la demande et la fiche client sont mises à jour
 * dans la même transaction, pour qu'un statut client ne puisse jamais
 * diverger de la décision qui l'a produit.
 *
 * `validate` et `reject` closent la demande ; `request_info` la laisse ouverte
 * — le dossier reste dans la file, en attendant les pièces réclamées.
 */
export async function decideValidationRequest(id: number, input: DecisionInput) {
	const message = input.message?.trim() || null;

	// R9 : un refus est obligatoirement motivé, le motif partant au client.
	if (input.decision === 'reject' && !message) {
		throw new ValidationError('Le motif du refus est obligatoire.');
	}
	if (input.decision === 'request_info' && !message) {
		throw new ValidationError('Précisez les éléments manquants à fournir.');
	}

	return db.transaction(async (tx) => {
		const [request] = await tx
			.select()
			.from(accountValidationRequest)
			.where(eq(accountValidationRequest.id, id))
			.limit(1);

		if (!request) throw new ValidationError('Demande introuvable.');
		if (request.status !== 'pending') {
			throw new ValidationError('Cette demande a déjà été traitée.');
		}

		const now = new Date();

		if (input.decision === 'request_info') {
			// Le dossier reste en attente : seule la relance est enregistrée.
			const [updated] = await tx
				.update(accountValidationRequest)
				.set({
					infoRequestedAt: now,
					infoRequested: message,
					reviewNotes: input.reviewNotes?.trim() || request.reviewNotes,
					updatedAt: now
				})
				.where(eq(accountValidationRequest.id, id))
				.returning();
			return updated;
		}

		const decided: CustomerStatus = input.decision === 'validate' ? 'validated' : 'rejected';

		const [updated] = await tx
			.update(accountValidationRequest)
			.set({
				status: decided,
				reviewedBy: input.reviewerId ?? null,
				reviewedAt: now,
				reviewNotes: input.reviewNotes?.trim() || null,
				rejectionReason: decided === 'rejected' ? message : null,
				updatedAt: now
			})
			.where(eq(accountValidationRequest.id, id))
			.returning();

		// Le statut du client suit la décision la plus récente.
		await tx
			.update(customer)
			.set({
				status: decided,
				statusUpdatedAt: now,
				rejectionReason: decided === 'rejected' ? message : null,
				// Le justificatif est réputé examiné à la validation (§5.4).
				...(decided === 'validated' ? { kbisValidatedAt: now } : {}),
				updatedAt: now
			})
			.where(eq(customer.id, request.customerId));

		return updated;
	});
}

/**
 * Resoumet un dossier après un refus (R10).
 *
 * L'ancienne demande est conservée ; une nouvelle est ouverte et le compte
 * repasse en attente.
 */
export async function resubmitValidationRequest(customerId: number, submitted: SubmittedData) {
	return db.transaction(async (tx) => {
		const [client] = await tx.select().from(customer).where(eq(customer.id, customerId)).limit(1);
		if (!client) throw new ValidationError('Client introuvable.');

		const type = normalizeCustomerType(client.type);
		if (!requiresValidation(type)) {
			throw new ValidationError('Ce type de compte ne requiert pas de validation.');
		}

		const [already] = await tx
			.select({ id: accountValidationRequest.id })
			.from(accountValidationRequest)
			.where(
				and(
					eq(accountValidationRequest.customerId, customerId),
					eq(accountValidationRequest.status, 'pending')
				)
			)
			.limit(1);

		if (already) throw new ValidationError('Un dossier est déjà en cours d’examen.');

		const now = new Date();
		await tx
			.update(customer)
			.set({ status: 'pending', statusUpdatedAt: now, rejectionReason: null, updatedAt: now })
			.where(eq(customer.id, customerId));

		return openValidationRequest(customerId, type as ValidationRequestType, submitted, tx);
	});
}

/** Nombre de dossiers en attente — tuile du tableau de bord. */
export async function countPendingRequests(): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(accountValidationRequest)
		.where(eq(accountValidationRequest.status, 'pending'));
	return Number(row?.n ?? 0);
}

/** Extrait une décision d'un formulaire admin. */
export function parseDecisionForm(form: FormData): DecisionInput | { error: string } {
	const raw = form.get('decision')?.toString().trim();
	if (raw !== 'validate' && raw !== 'reject' && raw !== 'request_info') {
		return { error: 'Décision inconnue.' };
	}

	return {
		decision: raw,
		message: form.get('message')?.toString().trim() || null,
		reviewNotes: form.get('reviewNotes')?.toString().trim() || null
	};
}

/** Garde-fou : une demande ne concerne qu'un compte à valider. */
export function assertValidatable(type?: string | null) {
	if (!requiresValidation(type)) {
		throw new ValidationError('Seuls les comptes professionnels et collectivités sont validés.');
	}
}

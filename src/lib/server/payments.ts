/**
 * Encaissement par carte bancaire — CDC section 20.
 *
 * Fait le lien entre le protocole Monetico (`$lib/server/monetico`, sans accès
 * base) et les commandes : journalisation des échanges, transitions d'état,
 * idempotence des notifications.
 *
 * Toutes les mises à jour de commande passent par `applyPaymentResult` :
 * jamais une écriture directe de l'état depuis une route, sur le modèle de
 * `changeRepairStatus` (CDC 31).
 */

import { desc, eq } from 'drizzle-orm';
import { db } from './db';
import { order, orderState, orderStateHistory } from './db/order.schema';
import { paymentTransaction, type PaymentDirection } from './db/payment.schema';
import { moneticoConfig, verifyReturn, type MoneticoConfig, type ReturnVerdict } from './monetico';

/** États d'arrivée d'une commande réglée par carte. */
const PAID_STATE = 'paiement-accepte';
const FAILED_STATE = 'erreur-de-paiement';
const AWAITING_STATE = 'en-attente-de-votre-reglement-cb';

export const MONETICO_PROVIDER = 'monetico';

/** Erreur métier de l'encaissement. */
export class PaymentError extends Error {}

/** Consigne un échange avec la plateforme (CDC 20). */
export async function logTransaction(entry: {
	orderId?: number | null;
	provider?: string;
	reference?: string | null;
	direction: PaymentDirection;
	rawPayload?: string | null;
	signatureReceived?: string | null;
	signatureExpected?: string | null;
	signatureValid?: boolean | null;
	returnCode?: string | null;
	refusalReason?: string | null;
	authNumber?: string | null;
	httpStatus?: number | null;
	remoteIp?: string | null;
}) {
	const [row] = await db
		.insert(paymentTransaction)
		.values({ provider: MONETICO_PROVIDER, ...entry })
		.returning();
	return row;
}

/** Journal d'une commande, le plus récent d'abord — back-office. */
export function listTransactions(orderId: number) {
	return db
		.select()
		.from(paymentTransaction)
		.where(eq(paymentTransaction.orderId, orderId))
		.orderBy(desc(paymentTransaction.createdAt));
}

/** Commande désignée par une référence de paiement. */
export async function orderByReference(reference: string) {
	const [row] = await db.select().from(order).where(eq(order.reference, reference)).limit(1);
	return row;
}

/**
 * Prépare une commande à partir en paiement.
 *
 * L'état « en attente de règlement CB » distingue une commande engagée dans un
 * tunnel de paiement d'une commande simplement créée : sans lui, un abandon en
 * cours de route serait indiscernable d'un encaissement perdu.
 */
export async function markAwaitingPayment(orderId: number, actor = 'système') {
	return db.transaction(async (tx) => {
		const [state] = await tx
			.select({ id: orderState.id })
			.from(orderState)
			.where(eq(orderState.code, AWAITING_STATE))
			.limit(1);
		if (!state) throw new PaymentError('État « en attente de règlement CB » introuvable.');

		const [current] = await tx.select().from(order).where(eq(order.id, orderId)).limit(1);
		if (!current) throw new PaymentError('Commande introuvable.');

		// Une commande déjà réglée ne repart pas en paiement.
		if (current.paidAt) throw new PaymentError('Cette commande est déjà réglée.');
		if (current.stateId === state.id) return current;

		await tx
			.update(order)
			.set({ stateId: state.id, paymentProvider: MONETICO_PROVIDER, updatedAt: new Date() })
			.where(eq(order.id, orderId));

		await tx.insert(orderStateHistory).values({
			orderId,
			stateId: state.id,
			note: 'Départ vers la page de paiement Monetico.',
			changedBy: actor
		});

		return current;
	});
}

/**
 * Applique le résultat d'un paiement à une commande.
 *
 * **Idempotent** : la banque rejoue une notification tant qu'elle n'a pas reçu
 * d'accusé de réception, et le retour navigateur peut arriver avant elle. Une
 * commande déjà réglée n'est donc jamais retouchée — ni son état, ni sa date
 * de paiement, ni son historique.
 *
 * Le montant est revérifié : un sceau valide prouve que le message vient de la
 * banque, pas qu'il correspond à la commande attendue.
 */
export async function applyPaymentResult(
	verdict: ReturnVerdict,
	options: { actor?: string } = {}
): Promise<{ applied: boolean; reason?: string; orderId?: number }> {
	// Un message non authentifié ne touche jamais une commande.
	if (!verdict.valid) return { applied: false, reason: 'Sceau invalide.' };

	return db.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(order)
			.where(eq(order.reference, verdict.reference))
			.limit(1);

		if (!current) return { applied: false, reason: 'Commande introuvable.' };

		// Rejeu : la notification a déjà été traitée.
		if (current.paidAt) return { applied: false, reason: 'Déjà réglée.', orderId: current.id };

		if (verdict.accepted) {
			// Le sceau authentifie l'expéditeur, pas la cohérence du montant.
			const expected = `${Number(current.totalTtc).toFixed(2)}EUR`;
			if (verdict.amount && verdict.amount !== expected) {
				return {
					applied: false,
					reason: `Montant incohérent : ${verdict.amount} reçu, ${expected} attendu.`,
					orderId: current.id
				};
			}
		}

		const targetCode = verdict.accepted ? PAID_STATE : FAILED_STATE;
		const [state] = await tx
			.select({ id: orderState.id })
			.from(orderState)
			.where(eq(orderState.code, targetCode))
			.limit(1);
		if (!state) throw new PaymentError(`État « ${targetCode} » introuvable.`);

		const now = new Date();
		await tx
			.update(order)
			.set({
				stateId: state.id,
				paymentProvider: MONETICO_PROVIDER,
				paymentReference: verdict.authNumber ?? verdict.returnCode,
				...(verdict.accepted ? { paidAt: now } : {}),
				updatedAt: now
			})
			.where(eq(order.id, current.id));

		await tx.insert(orderStateHistory).values({
			orderId: current.id,
			stateId: state.id,
			note: verdict.accepted
				? `Paiement accepté (${verdict.returnCode}${
						verdict.authNumber ? `, autorisation ${verdict.authNumber}` : ''
					}).`
				: `Paiement refusé (${verdict.returnCode}${
						verdict.refusalReason ? ` — ${verdict.refusalReason}` : ''
					}).`,
			changedBy: options.actor ?? 'Monetico'
		});

		return { applied: true, orderId: current.id };
	});
}

/**
 * Traite une notification serveur : vérification, journal, mise à jour.
 *
 * Retourne le verdict, que l'appelant convertit en accusé de réception — ce
 * dernier ne dépend que de la validité du sceau (§1.5.2 de la documentation),
 * jamais de l'issue du traitement.
 */
export async function handlePaymentNotification(
	params: Record<string, string | undefined>,
	context: { rawBody?: string; remoteIp?: string | null; config?: MoneticoConfig } = {}
): Promise<ReturnVerdict> {
	const config = context.config ?? moneticoConfig();
	const verdict = verifyReturn(config, params);

	const existing = verdict.reference ? await orderByReference(verdict.reference) : undefined;

	let outcome: { applied: boolean; reason?: string };
	try {
		outcome = await applyPaymentResult(verdict);
	} catch (err) {
		// L'échec de traitement ne doit pas empêcher la journalisation : c'est
		// elle qui permettra de rejouer l'encaissement.
		outcome = { applied: false, reason: err instanceof Error ? err.message : 'Échec inconnu.' };
	}

	await logTransaction({
		orderId: existing?.id ?? null,
		reference: verdict.reference || null,
		direction: 'incoming',
		rawPayload: context.rawBody ?? JSON.stringify(params),
		signatureReceived: params.MAC ?? null,
		signatureValid: verdict.valid,
		returnCode: verdict.returnCode || null,
		refusalReason: outcome.applied ? verdict.refusalReason : (outcome.reason ?? null),
		authNumber: verdict.authNumber,
		remoteIp: context.remoteIp ?? null
	});

	return verdict;
}

/**
 * Règlements saisis en back-office (demande client 1.1) : accès à la base.
 *
 * Vocabulaire partagé (modes, libellés, reste à régler) : `$lib/settlements`.
 */
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { repairOrder } from '$lib/server/db/repair.schema';
import { settlement } from '$lib/server/db/settlement.schema';
import { formFields, type ParseResult } from '$lib/server/forms';
import { formatPrice } from '$lib/money';
import {
	buildSettlementReference,
	isSettlementMethod,
	remainingDue,
	type SettlementMethod
} from '$lib/settlements';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class SettlementError extends Error {}

export type SettlementInput = {
	method: SettlementMethod;
	/** Montant au centime, chaîne prête pour la colonne numeric. */
	amount: string;
	/** `AAAA-MM-JJ`. */
	receivedOn: string;
	chequeNumber: string | null;
	chequeIssuer: string | null;
	chequeBank: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSettlementForm(form: FormData): ParseResult<SettlementInput> {
	const { str, money } = formFields(form);

	const method = str('method');
	if (!isSettlementMethod(method)) return { ok: false, error: 'Choisissez le mode de règlement.' };

	const amount = money('amount');
	if (!amount || Number(amount) <= 0) {
		return { ok: false, error: 'Indiquez un montant supérieur à zéro.' };
	}

	const receivedOn = str('receivedOn');
	if (!receivedOn || !ISO_DATE.test(receivedOn)) {
		return { ok: false, error: 'Indiquez la date de réception.' };
	}

	const isCheque = method === 'cheque';
	const chequeNumber = isCheque ? str('chequeNumber') : null;
	if (isCheque && !chequeNumber) {
		return { ok: false, error: 'Indiquez le numéro du chèque.' };
	}

	return {
		ok: true,
		values: {
			method,
			amount,
			receivedOn,
			chequeNumber,
			chequeIssuer: isCheque ? str('chequeIssuer') : null,
			chequeBank: isCheque ? str('chequeBank') : null
		}
	};
}

/** Règlements d'un ordre de réparation, du plus ancien au plus récent. */
export function listRepairSettlements(repairOrderId: number) {
	return db
		.select()
		.from(settlement)
		.where(eq(settlement.repairOrderId, repairOrderId))
		.orderBy(asc(settlement.receivedOn), asc(settlement.id));
}

/**
 * Enregistre un règlement sur un ordre de réparation (R19).
 *
 * Après l'achèvement des travaux, pour une prise en charge payante, et dans
 * la limite du reste à régler. L'ordre passe « réglé » quand le total est
 * atteint ; plusieurs règlements partiels sont admis (chèque + espèces).
 */
export async function recordRepairSettlement(
	repairOrderId: number,
	input: SettlementInput,
	actor: string | null
) {
	return db.transaction(async (tx) => {
		// Verrou sur l'ordre : deux saisies simultanées ne dépassent pas le total.
		const [order] = await tx
			.select({
				status: repairOrder.status,
				orderType: repairOrder.orderType,
				totalTtc: repairOrder.totalTtc,
				paidAt: repairOrder.paidAt
			})
			.from(repairOrder)
			.where(eq(repairOrder.id, repairOrderId))
			.for('update');

		if (!order) throw new SettlementError('Ordre introuvable.');
		if (order.orderType !== 'paid') {
			throw new SettlementError('Prise en charge sous garantie : rien n’est dû par le client.');
		}
		if (order.status !== 'completed' && order.status !== 'delivered') {
			throw new SettlementError('Le règlement s’enregistre une fois les travaux achevés.');
		}

		const previous = await tx
			.select({ amount: settlement.amount })
			.from(settlement)
			.where(eq(settlement.repairOrderId, repairOrderId));
		const due = order.paidAt
			? 0
			: remainingDue(
					order.totalTtc,
					previous.map((p) => p.amount)
				);

		if (due <= 0) throw new SettlementError('Cet ordre est déjà réglé.');
		if (Number(input.amount) > due) {
			throw new SettlementError(`Le montant dépasse le reste à régler (${formatPrice(due)}).`);
		}

		// Identifiant réservé d'abord : la référence en dépend.
		const [{ id }] = await tx.execute<{ id: number }>(
			sql`select nextval(pg_get_serial_sequence('settlement', 'id'))::int as id`
		);

		const [created] = await tx
			.insert(settlement)
			.values({
				id,
				reference: buildSettlementReference(id, input.receivedOn),
				method: input.method,
				amount: input.amount,
				receivedOn: input.receivedOn,
				chequeNumber: input.chequeNumber,
				chequeIssuer: input.chequeIssuer,
				chequeBank: input.chequeBank,
				repairOrderId,
				createdBy: actor
			})
			.returning();

		if (remainingDue(due, [input.amount]) <= 0) {
			await tx
				.update(repairOrder)
				.set({ paidAt: new Date(`${input.receivedOn}T12:00:00`), updatedAt: new Date() })
				.where(eq(repairOrder.id, repairOrderId));
		}

		return created;
	});
}

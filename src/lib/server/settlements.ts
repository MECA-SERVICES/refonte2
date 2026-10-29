/**
 * Règlements saisis en back-office (demande client 1.1) : accès à la base.
 *
 * Vocabulaire partagé (modes, libellés, reste à régler) : `$lib/settlements`.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customer } from '$lib/server/db/customer.schema';
import { repairOrder } from '$lib/server/db/repair.schema';
import { remittance, settlement } from '$lib/server/db/settlement.schema';
import { counterInvoice } from '$lib/server/db/counter-invoice.schema';
import { formFields, type ParseResult } from '$lib/server/forms';
import { formatPrice } from '$lib/money';
import {
	buildRemittanceReference,
	buildSettlementReference,
	isRemittanceKind,
	isSettlementMethod,
	remainingDue,
	remittanceKinds,
	type RemittanceKind,
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

// ===========================================================================
// Bordereaux de remise en banque (demande client 1.2)
// ===========================================================================

/**
 * Ligne de bordereau : le règlement, et ce qui permet de le reconnaître —
 * l'ordre de réparation réglé et son client.
 */
const remittanceLine = {
	id: settlement.id,
	reference: settlement.reference,
	method: settlement.method,
	amount: settlement.amount,
	receivedOn: settlement.receivedOn,
	chequeNumber: settlement.chequeNumber,
	chequeIssuer: settlement.chequeIssuer,
	chequeBank: settlement.chequeBank,
	repairOrderId: settlement.repairOrderId,
	repairReference: repairOrder.reference,
	counterInvoiceId: settlement.counterInvoiceId,
	invoiceNumber: counterInvoice.number,
	customerFirstName: customer.firstName,
	customerLastName: customer.lastName,
	customerCompany: customer.companyName
};

function remittanceLines() {
	return (
		db
			.select(remittanceLine)
			.from(settlement)
			.leftJoin(repairOrder, eq(repairOrder.id, settlement.repairOrderId))
			.leftJoin(counterInvoice, eq(counterInvoice.id, settlement.counterInvoiceId))
			// Le client : celui de l'ordre de réparation, à défaut celui de la facture comptoir.
			.leftJoin(
				customer,
				eq(customer.id, sql`coalesce(${repairOrder.customerId}, ${counterInvoice.customerId})`)
			)
	);
}

export type RemittanceLine = Awaited<ReturnType<typeof listPendingSettlements>>[number];

/** Règlements encore en caisse : pas encore portés sur un bordereau. */
export function listPendingSettlements(kind: RemittanceKind) {
	return (
		remittanceLines()
			// Les règlements repris de Dolibarr sont déjà en banque.
			.where(
				and(
					eq(settlement.method, kind),
					isNull(settlement.remittanceId),
					isNull(settlement.legacyDoliId)
				)
			)
			.orderBy(asc(settlement.receivedOn), asc(settlement.id))
	);
}

/** Nombre et montant des règlements en caisse, par nature de bordereau. */
export async function pendingRemittanceTotals() {
	const rows = await db
		.select({
			method: settlement.method,
			count: sql<number>`count(*)::int`,
			total: sql<string>`coalesce(sum(${settlement.amount}), 0)::text`
		})
		.from(settlement)
		.where(
			and(
				inArray(settlement.method, [...remittanceKinds]),
				isNull(settlement.remittanceId),
				isNull(settlement.legacyDoliId)
			)
		)
		.groupBy(settlement.method);

	return Object.fromEntries(
		remittanceKinds.map((kind) => {
			const row = rows.find((r) => r.method === kind);
			return [kind, { count: row?.count ?? 0, total: row?.total ?? '0' }];
		})
	) as Record<RemittanceKind, { count: number; total: string }>;
}

export type RemittanceInput = {
	kind: RemittanceKind;
	settlementIds: number[];
	depositedOn: string;
	bankAccount: string;
};

export function parseRemittanceForm(form: FormData): ParseResult<RemittanceInput> {
	const { str } = formFields(form);

	const kind = str('kind');
	if (!isRemittanceKind(kind)) return { ok: false, error: 'Nature du bordereau inconnue.' };

	const settlementIds = [
		...new Set(
			form
				.getAll('settlementId')
				.map((v) => Number(v))
				.filter((n) => Number.isInteger(n) && n > 0)
		)
	];
	if (settlementIds.length === 0) {
		return { ok: false, error: 'Cochez au moins un règlement à remettre en banque.' };
	}

	const depositedOn = str('depositedOn');
	if (!depositedOn || !ISO_DATE.test(depositedOn)) {
		return { ok: false, error: 'Indiquez la date de remise.' };
	}

	const bankAccount = str('bankAccount');
	if (!bankAccount) return { ok: false, error: 'Indiquez le compte bancaire crédité.' };

	return { ok: true, values: { kind, settlementIds, depositedOn, bankAccount } };
}

/**
 * Crée un bordereau validé et y rattache les règlements cochés.
 *
 * Les règlements sont verrouillés le temps de l'opération : un règlement ne
 * peut figurer que sur un seul bordereau, même si deux saisies se croisent.
 */
export async function createRemittance(input: RemittanceInput, actor: string | null) {
	return db.transaction(async (tx) => {
		const rows = await tx
			.select({
				id: settlement.id,
				method: settlement.method,
				amount: settlement.amount,
				remittanceId: settlement.remittanceId
			})
			.from(settlement)
			.where(inArray(settlement.id, input.settlementIds))
			.for('update');

		if (rows.length !== input.settlementIds.length) {
			throw new SettlementError('Un des règlements cochés est introuvable : rechargez la page.');
		}
		if (rows.some((r) => r.method !== input.kind)) {
			throw new SettlementError('Un bordereau ne mélange pas chèques et espèces.');
		}
		if (rows.some((r) => r.remittanceId !== null)) {
			throw new SettlementError(
				'Un des règlements figure déjà sur un bordereau : rechargez la page.'
			);
		}

		const total = rows.reduce((sum, r) => sum + Number(r.amount), 0).toFixed(2);

		const [{ id }] = await tx.execute<{ id: number }>(
			sql`select nextval(pg_get_serial_sequence('remittance', 'id'))::int as id`
		);

		const [created] = await tx
			.insert(remittance)
			.values({
				id,
				reference: buildRemittanceReference(input.kind, id, input.depositedOn),
				kind: input.kind,
				bankAccount: input.bankAccount,
				depositedOn: input.depositedOn,
				total,
				settlementCount: rows.length,
				createdBy: actor
			})
			.returning();

		await tx
			.update(settlement)
			.set({ remittanceId: created.id })
			.where(inArray(settlement.id, input.settlementIds));

		return created;
	});
}

/** Bordereaux, du plus récent au plus ancien. */
export function listRemittances() {
	return db.select().from(remittance).orderBy(desc(remittance.depositedOn), desc(remittance.id));
}

/** Bordereau et ses lignes, dans l'ordre de réception. */
export async function getRemittance(id: number) {
	const [head] = await db.select().from(remittance).where(eq(remittance.id, id)).limit(1);
	if (!head) return null;

	const lines = await remittanceLines()
		.where(eq(settlement.remittanceId, id))
		.orderBy(asc(settlement.receivedOn), asc(settlement.id));

	return { ...head, lines };
}

/**
 * Supprime un bordereau saisi par erreur : ses règlements retournent en
 * caisse, prêts pour un nouveau bordereau. Les règlements eux-mêmes restent.
 */
export async function deleteRemittance(id: number) {
	await db.transaction(async (tx) => {
		await tx.update(settlement).set({ remittanceId: null }).where(eq(settlement.remittanceId, id));
		await tx.delete(remittance).where(eq(remittance.id, id));
	});
}

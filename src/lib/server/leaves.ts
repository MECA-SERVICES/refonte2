/**
 * Congés de l'équipe (module Congés de Dolibarr).
 *
 * - Chaque salarié demande ses congés ; un administrateur les approuve ou
 *   les refuse. Approuver décompte le solde (congés payés, RTT) ; annuler un
 *   congé approuvé le recrédite.
 * - Les soldes s'acquièrent chaque mois (`MONTHLY_ACCRUAL`), à la première
 *   lecture du mois : pas de tâche planifiée à maintenir.
 * - Tout mouvement de solde est journalisé, comme dans Dolibarr.
 */
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { leaveBalance, leaveBalanceLog, leaveRequest } from '$lib/server/db/leave.schema';
import type { ParseResult } from '$lib/server/forms';
import { staffRoles } from '$lib/roles';
import {
	balanceTypes,
	hasBalance,
	isLeaveType,
	leaveDays,
	leaveReference,
	MONTHLY_ACCRUAL,
	monthsToAccrue,
	type BalanceType,
	type LeaveStatus,
	type LeaveType
} from '$lib/leaves';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class LeaveError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const thisMonth = () => new Date().toISOString().slice(0, 7);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Comptes de l'équipe (employés et administrateurs), actifs. */
export function staffMembers() {
	return db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(and(inArray(user.role, [...staffRoles]), sql`coalesce(${user.banned}, false) = false`))
		.orderBy(asc(user.name));
}

/**
 * Crée les soldes manquants (à zéro, acquisition à partir du mois prochain)
 * et ajoute les mois écoulés depuis la dernière acquisition.
 */
export async function refreshBalances(userIds: string[]) {
	if (!userIds.length) return;
	const month = thisMonth();
	await db
		.insert(leaveBalance)
		.values(
			userIds.flatMap((userId) =>
				balanceTypes.map((type) => ({ userId, type, accruedThrough: month }))
			)
		)
		.onConflictDoNothing();
	await db.transaction(async (tx) => {
		const due = await tx
			.select({ balance: leaveBalance, name: user.name })
			.from(leaveBalance)
			.innerJoin(user, eq(user.id, leaveBalance.userId))
			.where(and(inArray(leaveBalance.userId, userIds), lt(leaveBalance.accruedThrough, month)))
			.for('update', { of: leaveBalance });
		for (const { balance, name } of due) {
			const months = monthsToAccrue(balance.accruedThrough, `${month}-01`);
			const added = round3(months * (MONTHLY_ACCRUAL[balance.type] ?? 0));
			const next = round3(Number(balance.days) + added);
			await tx
				.update(leaveBalance)
				.set({ days: next.toFixed(3), accruedThrough: month, updatedAt: new Date() })
				.where(eq(leaveBalance.id, balance.id));
			await tx.insert(leaveBalanceLog).values({
				userId: balance.userId,
				employeeName: name,
				type: balance.type,
				previousDays: balance.days,
				newDays: next.toFixed(3),
				reason: `Acquisition mensuelle (${months} mois)`
			});
		}
	});
}

/** Soldes d'un salarié, par type. */
export async function balancesOf(userId: string) {
	await refreshBalances([userId]);
	const rows = await db.select().from(leaveBalance).where(eq(leaveBalance.userId, userId));
	return Object.fromEntries(rows.map((r) => [r.type, Number(r.days)])) as Partial<
		Record<BalanceType, number>
	>;
}

/** Soldes de toute l'équipe, pour l'administrateur. */
export async function teamBalances() {
	const members = await staffMembers();
	await refreshBalances(members.map((m) => m.id));
	const rows = await db
		.select()
		.from(leaveBalance)
		.where(
			inArray(
				leaveBalance.userId,
				members.map((m) => m.id)
			)
		);
	return members.map((m) => ({
		...m,
		balances: Object.fromEntries(
			rows.filter((r) => r.userId === m.id).map((r) => [r.type, Number(r.days)])
		) as Partial<Record<BalanceType, number>>
	}));
}

/** Demandes d'un salarié, les plus récentes d'abord. */
export function leavesOf(userId: string) {
	return db
		.select()
		.from(leaveRequest)
		.where(eq(leaveRequest.userId, userId))
		.orderBy(desc(leaveRequest.startOn), desc(leaveRequest.id));
}

/** Toutes les demandes : à approuver d'abord, puis les plus récentes. */
export function teamLeaves(status: LeaveStatus | null) {
	return db
		.select()
		.from(leaveRequest)
		.where(status ? eq(leaveRequest.status, status) : undefined)
		.orderBy(
			sql`${leaveRequest.status} = 'pending' desc`,
			desc(leaveRequest.startOn),
			desc(leaveRequest.id)
		)
		.limit(300);
}

/** Journal des soldes d'un salarié, ou de toute l'équipe. */
export function balanceLog(userId: string | null, limit = 50) {
	return db
		.select()
		.from(leaveBalanceLog)
		.where(userId ? eq(leaveBalanceLog.userId, userId) : undefined)
		.orderBy(desc(leaveBalanceLog.createdAt), desc(leaveBalanceLog.id))
		.limit(limit);
}

export type LeaveInput = {
	type: LeaveType;
	startOn: string;
	endOn: string;
	startsAfternoon: boolean;
	endsAtNoon: boolean;
	description: string | null;
};

export function parseLeaveForm(form: FormData): ParseResult<LeaveInput> {
	const type = form.get('type')?.toString();
	const startOn = form.get('startOn')?.toString() ?? '';
	const endOn = form.get('endOn')?.toString() || startOn;
	if (!isLeaveType(type)) return { ok: false, error: 'Choisissez le type de congé.' };
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endOn)) {
		return { ok: false, error: 'Indiquez les dates du congé.' };
	}
	if (endOn < startOn) return { ok: false, error: 'La fin précède le début.' };
	return {
		ok: true,
		values: {
			type,
			startOn,
			endOn,
			startsAfternoon: form.get('startsAfternoon') === 'on',
			endsAtNoon: form.get('endsAtNoon') === 'on',
			description: form.get('description')?.toString().trim() || null
		}
	};
}

/** Nouvelle demande d'un salarié, à approuver. */
export async function requestLeave(member: { id: string; name: string }, input: LeaveInput) {
	const days = leaveDays(input.startOn, input.endOn, input.startsAfternoon, input.endsAtNoon);
	if (!days) throw new LeaveError('Aucun jour ouvré sur cette période.');
	await db.transaction(async (tx) => {
		const overlap = await tx
			.select({ reference: leaveRequest.reference })
			.from(leaveRequest)
			.where(
				and(
					eq(leaveRequest.userId, member.id),
					inArray(leaveRequest.status, ['pending', 'approved']),
					sql`${leaveRequest.startOn} <= ${input.endOn} and ${leaveRequest.endOn} >= ${input.startOn}`
				)
			)
			.limit(1);
		if (overlap.length) {
			throw new LeaveError(`Cette période chevauche la demande ${overlap[0].reference}.`);
		}
		const [{ n }] = await tx.execute<{ n: string }>(
			sql`select nextval('leave_number_seq')::text as n`
		);
		await tx.insert(leaveRequest).values({
			...input,
			reference: leaveReference(new Date(), Number(n)),
			userId: member.id,
			employeeName: member.name,
			days: days.toFixed(2)
		});
	});
}

/** Ajoute `delta` jours au solde et journalise le mouvement. */
async function moveBalance(
	tx: Tx,
	userId: string,
	type: BalanceType,
	delta: number,
	reason: string,
	actorName: string | null
) {
	const [b] = await tx
		.select({ balance: leaveBalance, name: user.name })
		.from(leaveBalance)
		.innerJoin(user, eq(user.id, leaveBalance.userId))
		.where(and(eq(leaveBalance.userId, userId), eq(leaveBalance.type, type)))
		.for('update', { of: leaveBalance });
	if (!b) return;
	const next = round3(Number(b.balance.days) + delta);
	await tx
		.update(leaveBalance)
		.set({ days: next.toFixed(3), updatedAt: new Date() })
		.where(eq(leaveBalance.id, b.balance.id));
	await tx.insert(leaveBalanceLog).values({
		userId,
		employeeName: b.name,
		type,
		previousDays: b.balance.days,
		newDays: next.toFixed(3),
		reason,
		actorName
	});
}

async function lockRequest(tx: Tx, id: number) {
	const [request] = await tx
		.select()
		.from(leaveRequest)
		.where(eq(leaveRequest.id, id))
		.for('update');
	if (!request) throw new LeaveError('Demande introuvable.');
	return request;
}

/** Décision de l'administrateur sur une demande à approuver. */
export async function decideLeave(
	id: number,
	approve: boolean,
	actor: { id: string; name: string },
	note: string | null
) {
	if (!approve && !note) throw new LeaveError('Indiquez le motif du refus.');
	await db.transaction(async (tx) => {
		const request = await lockRequest(tx, id);
		if (request.status !== 'pending') throw new LeaveError('Cette demande est déjà traitée.');
		if (approve && request.userId && hasBalance(request.type)) {
			await refreshBalances([request.userId]);
			await moveBalance(
				tx,
				request.userId,
				request.type,
				-Number(request.days),
				`Congé ${request.reference} approuvé`,
				actor.name
			);
		}
		await tx
			.update(leaveRequest)
			.set({
				status: approve ? 'approved' : 'refused',
				decisionNote: note,
				decidedBy: actor.id,
				decidedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(leaveRequest.id, id));
	});
}

/**
 * Annule une demande : le salarié la sienne tant qu'elle attend ;
 * l'administrateur toute demande, un congé approuvé étant alors recrédité.
 */
export async function cancelLeave(
	id: number,
	actor: { id: string; name: string; isAdmin: boolean },
	note: string | null
) {
	await db.transaction(async (tx) => {
		const request = await lockRequest(tx, id);
		const own = request.userId === actor.id;
		if (request.status === 'cancelled' || request.status === 'refused') {
			throw new LeaveError('Cette demande est déjà close.');
		}
		if (!actor.isAdmin && !(own && request.status === 'pending')) {
			throw new LeaveError('Seul un administrateur annule un congé approuvé.');
		}
		if (request.status === 'approved' && request.userId && hasBalance(request.type)) {
			await moveBalance(
				tx,
				request.userId,
				request.type,
				Number(request.days),
				`Congé ${request.reference} annulé`,
				actor.name
			);
		}
		await tx
			.update(leaveRequest)
			.set({
				status: 'cancelled',
				decisionNote: note,
				decidedBy: actor.id,
				decidedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(leaveRequest.id, id));
	});
}

/** Correction d'un solde par l'administrateur (report, régularisation). */
export async function setBalance(
	userId: string,
	type: BalanceType,
	days: number,
	reason: string,
	actorName: string
) {
	if (!Number.isFinite(days)) throw new LeaveError('Le solde est un nombre de jours.');
	if (!reason.trim()) throw new LeaveError('Indiquez le motif de la correction.');
	await refreshBalances([userId]);
	await db.transaction(async (tx) => {
		const [b] = await tx
			.select({ days: leaveBalance.days })
			.from(leaveBalance)
			.where(and(eq(leaveBalance.userId, userId), eq(leaveBalance.type, type)));
		if (!b) throw new LeaveError('Solde introuvable.');
		await moveBalance(tx, userId, type, days - Number(b.days), reason.trim(), actorName);
	});
}

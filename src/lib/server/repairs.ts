import { db } from '$lib/server/db';
import {
	repairOrder,
	repairOrderImage,
	repairOrderPart,
	type RepairOrderType,
	type RepairStatus
} from '$lib/server/db/repair.schema';
import { customer } from '$lib/server/db/customer.schema';
import { product } from '$lib/server/db/catalog.schema';
import { clientMachine } from '$lib/server/db/machine.schema';
import { recordStockMovement } from '$lib/server/catalog';
import { computeTax, effectiveTaxRate, resolveTaxRegime } from '$lib/tax';
import { canTransition, isFrozen, REPAIR_STATUS_LABELS, REPAIRS_PER_PAGE } from '$lib/repairs';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

/**
 * Vocabulaire de l'atelier — états, libellés, machine à états, pagination.
 *
 * Défini dans `$lib/repairs` pour rester importable par le navigateur ;
 * réexporté ici pour que le code serveur garde un point d'entrée unique.
 */
export {
	canTransition,
	isFrozen,
	nextStatuses,
	repairImageMoments,
	repairOrderTypes,
	repairStatuses,
	REPAIR_STATUS_COLORS,
	REPAIR_STATUS_LABELS,
	REPAIR_TYPE_LABELS,
	REPAIRS_PER_PAGE
} from '$lib/repairs';
export type { RepairImageMoment, RepairOrderType, RepairStatus } from '$lib/repairs';

/**
 * Ordres de réparation atelier (CDC 31).
 *
 * Deux principes gouvernent ce module :
 *
 * 1. **La machine à états est fermée** (§5) : « toute transition absente de ce
 *    tableau est refusée ». Les transitions passent donc toutes par
 *    `changeRepairStatus`, jamais par une écriture directe du statut.
 * 2. **Un ordre achevé est figé** (R17) : ni la main-d'œuvre ni les lignes de
 *    pièces ne sont plus modifiables. Seuls le règlement et la restitution
 *    peuvent encore l'enrichir (R19).
 */

/** Erreur métier de l'atelier, distinguée des pannes techniques. */
export class RepairError extends Error {}

// ===========================================================================
// Référence
// ===========================================================================

/**
 * Référence unique communiquée au client (R1).
 *
 * Format `OR-AAAA-XXXXXX`, sur le modèle des commandes. Le suffixe aléatoire
 * évite de divulguer le volume d'activité de l'atelier.
 */
export function buildRepairReference(): string {
	const alphabet = 'ACDEFGHJKLMNPQRTUVWXY3456789';
	let suffix = '';
	for (let i = 0; i < 6; i++) {
		suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return `OR-${new Date().getFullYear()}-${suffix}`;
}

// ===========================================================================
// Totaux
// ===========================================================================

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Recalcule les totaux d'un ordre (R8 à R11).
 *
 * Le taux vient du régime fiscal du client (R10). Un ordre sous garantie voit
 * ses montants calculés normalement, à des fins de suivi analytique, mais rien
 * n'est facturé (R15) — d'où un TTC nul dans ce seul cas.
 */
export async function recalculateTotals(repairOrderId: number, tx = db) {
	const [head] = await tx
		.select({
			diagnosticFee: repairOrder.diagnosticFee,
			laborAmount: repairOrder.laborAmount,
			orderType: repairOrder.orderType,
			customerType: customer.type,
			taxExemptStatus: customer.taxExemptStatus,
			customerStatus: customer.status,
			billingCountry: customer.billingCountry
		})
		.from(repairOrder)
		.leftJoin(customer, eq(customer.id, repairOrder.customerId))
		.where(eq(repairOrder.id, repairOrderId))
		.limit(1);

	if (!head) throw new RepairError('Ordre introuvable.');

	const [parts] = await tx
		.select({ total: sql<string>`COALESCE(SUM(${repairOrderPart.totalHt}), 0)` })
		.from(repairOrderPart)
		.where(eq(repairOrderPart.repairOrderId, repairOrderId));

	const totalPartsHt = round2(Number(parts?.total ?? 0));
	const totalHt = round2(
		Number(head.diagnosticFee ?? 0) + Number(head.laborAmount ?? 0) + totalPartsHt
	);

	const regime = resolveTaxRegime({
		country: head.billingCountry,
		type: head.customerType,
		taxExemptStatus: head.taxExemptStatus,
		status: head.customerStatus
	});
	// Les pièces et la main-d'œuvre relèvent du taux normal.
	const rate = effectiveTaxRate(20, regime);
	const tax = computeTax(totalHt, rate);

	// R15 : sous garantie, rien n'est dû par le client.
	const billed = head.orderType === 'warranty' ? 0 : tax.totalTtc;

	await tx
		.update(repairOrder)
		.set({
			totalPartsHt: totalPartsHt.toFixed(2),
			totalHt: tax.totalHt.toFixed(2),
			totalTva: tax.totalTva.toFixed(2),
			totalTtc: billed.toFixed(2),
			updatedAt: new Date()
		})
		.where(eq(repairOrder.id, repairOrderId));

	return { totalPartsHt, ...tax, totalTtc: billed };
}

// ===========================================================================
// Lecture
// ===========================================================================

/** File des travaux, filtrable par état et par recherche libre. */
export async function listRepairOrders(options: {
	status?: RepairStatus | 'all';
	search?: string;
	page?: number;
}) {
	const page = Math.max(1, options.page ?? 1);
	const filters = [];

	if (options.status && options.status !== 'all') {
		filters.push(eq(repairOrder.status, options.status));
	}

	const term = options.search?.trim();
	if (term) {
		const like = `%${term}%`;
		filters.push(
			or(
				ilike(repairOrder.reference, like),
				ilike(repairOrder.machineBrand, like),
				ilike(repairOrder.machineModel, like),
				ilike(repairOrder.serialNumber, like),
				ilike(customer.lastName, like),
				ilike(customer.email, like)
			)
		);
	}

	const where = filters.length > 0 ? and(...filters) : undefined;

	const [rows, [counted]] = await Promise.all([
		db
			.select({
				id: repairOrder.id,
				reference: repairOrder.reference,
				status: repairOrder.status,
				orderType: repairOrder.orderType,
				machineBrand: repairOrder.machineBrand,
				machineModel: repairOrder.machineModel,
				totalTtc: repairOrder.totalTtc,
				createdAt: repairOrder.createdAt,
				customerId: customer.id,
				customerFirstName: customer.firstName,
				customerLastName: customer.lastName
			})
			.from(repairOrder)
			.leftJoin(customer, eq(customer.id, repairOrder.customerId))
			.where(where)
			.orderBy(desc(repairOrder.createdAt))
			.limit(REPAIRS_PER_PAGE)
			.offset((page - 1) * REPAIRS_PER_PAGE),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(repairOrder)
			.leftJoin(customer, eq(customer.id, repairOrder.customerId))
			.where(where)
	]);

	return { rows, total: counted?.n ?? 0, page };
}

/** Compteur par état, pour les onglets de la file des travaux. */
export async function countByStatus() {
	const rows = await db
		.select({ status: repairOrder.status, n: sql<number>`count(*)::int` })
		.from(repairOrder)
		.groupBy(repairOrder.status);

	return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
		Record<RepairStatus, number>
	>;
}

/** Ordre complet : en-tête, client, pièces et photos. */
export async function getRepairOrder(id: number) {
	const [head] = await db
		.select({
			order: repairOrder,
			customerFirstName: customer.firstName,
			customerLastName: customer.lastName,
			customerEmail: customer.email,
			customerPhone: customer.phone,
			customerCompany: customer.companyName
		})
		.from(repairOrder)
		.leftJoin(customer, eq(customer.id, repairOrder.customerId))
		.where(eq(repairOrder.id, id))
		.limit(1);

	if (!head) return null;

	const [parts, images] = await Promise.all([
		db
			.select({
				id: repairOrderPart.id,
				productId: repairOrderPart.productId,
				partName: repairOrderPart.partName,
				partReference: repairOrderPart.partReference,
				quantity: repairOrderPart.quantity,
				unitPriceHt: repairOrderPart.unitPriceHt,
				totalHt: repairOrderPart.totalHt
			})
			.from(repairOrderPart)
			.where(eq(repairOrderPart.repairOrderId, id))
			.orderBy(repairOrderPart.id),
		db
			.select()
			.from(repairOrderImage)
			.where(eq(repairOrderImage.repairOrderId, id))
			.orderBy(repairOrderImage.position, repairOrderImage.id)
	]);

	return { ...head.order, customer: head, parts, images };
}

// ===========================================================================
// Écriture
// ===========================================================================

export type RepairOrderInput = {
	customerId: number;
	orderType: RepairOrderType;
	warrantyReference?: string | null;
	machineType?: string | null;
	machineBrand?: string | null;
	machineModel?: string | null;
	serialNumber?: string | null;
	machineCondition?: string | null;
	engineModel?: string | null;
	engineSerialNumber?: string | null;
	workDescription?: string | null;
	diagnosticFee?: number;
	laborAmount?: number;
	notes?: string | null;
	privateNote?: string | null;
};

/**
 * Crée un ordre pour une intervention au comptoir (R2, §7.2).
 *
 * L'accord du client est recueilli hors ligne : l'ordre naît directement à
 * l'état « à démarrer ».
 */
export async function createRepairOrder(input: RepairOrderInput) {
	// R14 : la garantie exige une référence de dossier.
	if (input.orderType === 'warranty' && !input.warrantyReference?.trim()) {
		throw new RepairError(
			'Une référence de dossier est requise pour une prise en charge sous garantie.'
		);
	}

	const [created] = await db
		.insert(repairOrder)
		.values({
			reference: buildRepairReference(),
			customerId: input.customerId,
			orderType: input.orderType,
			status: 'to_do',
			warrantyReference: input.warrantyReference?.trim() || null,
			machineType: input.machineType?.trim() || null,
			machineBrand: input.machineBrand?.trim() || null,
			machineModel: input.machineModel?.trim() || null,
			serialNumber: input.serialNumber?.trim() || null,
			machineCondition: input.machineCondition?.trim() || null,
			engineModel: input.engineModel?.trim() || null,
			engineSerialNumber: input.engineSerialNumber?.trim() || null,
			workDescription: input.workDescription?.trim() || null,
			diagnosticFee: (input.diagnosticFee ?? 0).toFixed(2),
			laborAmount: (input.laborAmount ?? 0).toFixed(2),
			notes: input.notes?.trim() || null,
			privateNote: input.privateNote?.trim() || null
		})
		.returning();

	await recalculateTotals(created.id);
	return created;
}

/** Met à jour l'en-tête d'un ordre encore modifiable (R17). */
export async function updateRepairOrder(id: number, input: Partial<RepairOrderInput>) {
	const current = await requireEditable(id);

	if ((input.orderType ?? current.orderType) === 'warranty') {
		const reference = input.warrantyReference ?? current.warrantyReference;
		if (!reference?.trim()) {
			throw new RepairError(
				'Une référence de dossier est requise pour une prise en charge sous garantie.'
			);
		}
	}

	await db
		.update(repairOrder)
		.set({
			...(input.orderType !== undefined ? { orderType: input.orderType } : {}),
			...(input.warrantyReference !== undefined
				? { warrantyReference: input.warrantyReference?.trim() || null }
				: {}),
			...(input.machineType !== undefined
				? { machineType: input.machineType?.trim() || null }
				: {}),
			...(input.machineBrand !== undefined
				? { machineBrand: input.machineBrand?.trim() || null }
				: {}),
			...(input.machineModel !== undefined
				? { machineModel: input.machineModel?.trim() || null }
				: {}),
			...(input.serialNumber !== undefined
				? { serialNumber: input.serialNumber?.trim() || null }
				: {}),
			...(input.machineCondition !== undefined
				? { machineCondition: input.machineCondition?.trim() || null }
				: {}),
			...(input.engineModel !== undefined
				? { engineModel: input.engineModel?.trim() || null }
				: {}),
			...(input.engineSerialNumber !== undefined
				? { engineSerialNumber: input.engineSerialNumber?.trim() || null }
				: {}),
			...(input.workDescription !== undefined
				? { workDescription: input.workDescription?.trim() || null }
				: {}),
			...(input.diagnosticFee !== undefined
				? { diagnosticFee: input.diagnosticFee.toFixed(2) }
				: {}),
			...(input.laborAmount !== undefined ? { laborAmount: input.laborAmount.toFixed(2) } : {}),
			...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
			...(input.privateNote !== undefined
				? { privateNote: input.privateNote?.trim() || null }
				: {}),
			updatedAt: new Date()
		})
		.where(eq(repairOrder.id, id));

	// R11 : les totaux suivent toute modification de montant.
	await recalculateTotals(id);
}

/** Vérifie qu'un ordre est encore modifiable, et le retourne. */
async function requireEditable(id: number) {
	const [row] = await db.select().from(repairOrder).where(eq(repairOrder.id, id)).limit(1);
	if (!row) throw new RepairError('Ordre introuvable.');
	if (isFrozen(row.status)) {
		throw new RepairError(
			'Cet ordre est figé : les travaux et les montants ne sont plus modifiables.'
		);
	}
	return row;
}

// ===========================================================================
// Pièces consommées
// ===========================================================================

/**
 * Ajoute une pièce à un ordre (R5, R6).
 *
 * Rattachée au catalogue, la pièce reprend désignation, référence et prix, et
 * **décrémente directement le stock physique** — sans réservation préalable,
 * puisqu'elle est posée sur la machine sur-le-champ.
 */
export async function addRepairPart(
	repairOrderId: number,
	input: {
		productId?: number | null;
		partName?: string | null;
		partReference?: string | null;
		quantity: number;
		unitPriceHt?: number | null;
	},
	createdBy?: string | null
) {
	const order = await requireEditable(repairOrderId);

	const quantity = Math.max(1, Math.trunc(input.quantity) || 1);
	let partName = input.partName?.trim() || '';
	let partReference = input.partReference?.trim() || null;
	let unitPriceHt = input.unitPriceHt ?? 0;

	if (input.productId) {
		const [item] = await db
			.select({
				name: product.name,
				reference: product.reference,
				priceHt: product.priceHt,
				stock: product.stock
			})
			.from(product)
			.where(eq(product.id, input.productId))
			.limit(1);

		if (!item) throw new RepairError('Article introuvable au catalogue.');

		// CDC 16, R12 : le stock physique ne peut pas devenir négatif.
		if (item.stock < quantity) {
			throw new RepairError(
				`Stock insuffisant : ${item.stock} en réserve pour « ${item.name} », ${quantity} demandée(s).`
			);
		}

		// Le catalogue fait foi : désignation, référence et prix en sont repris.
		partName = item.name;
		partReference = item.reference;
		if (input.unitPriceHt == null) unitPriceHt = Number(item.priceHt ?? 0);
	}

	if (!partName) throw new RepairError('La désignation de la pièce est requise.');

	const totalHt = round2(unitPriceHt * quantity);

	const [line] = await db
		.insert(repairOrderPart)
		.values({
			repairOrderId,
			productId: input.productId ?? null,
			partName,
			partReference,
			quantity,
			unitPriceHt: unitPriceHt.toFixed(2),
			totalHt: totalHt.toFixed(2)
		})
		.returning();

	if (input.productId) {
		await recordStockMovement({
			productId: input.productId,
			quantity: -quantity,
			type: 'repair',
			note: `Ordre de réparation ${order.reference}`,
			createdBy: createdBy ?? null
		});
	}

	await recalculateTotals(repairOrderId);
	return line;
}

/**
 * Retire une pièce d'un ordre (R7).
 *
 * Une pièce du catalogue réintègre le stock : elle n'a finalement pas été
 * posée sur la machine.
 */
export async function removeRepairPart(
	repairOrderId: number,
	partId: number,
	createdBy?: string | null
) {
	const order = await requireEditable(repairOrderId);

	const [line] = await db
		.select()
		.from(repairOrderPart)
		.where(and(eq(repairOrderPart.id, partId), eq(repairOrderPart.repairOrderId, repairOrderId)))
		.limit(1);

	if (!line) throw new RepairError('Ligne introuvable.');

	await db.delete(repairOrderPart).where(eq(repairOrderPart.id, partId));

	if (line.productId) {
		await recordStockMovement({
			productId: line.productId,
			quantity: line.quantity,
			type: 'repair',
			note: `Retrait de ligne — ordre ${order.reference}`,
			createdBy: createdBy ?? null
		});
	}

	await recalculateTotals(repairOrderId);
}

// ===========================================================================
// Transitions
// ===========================================================================

/**
 * Change l'état d'un ordre, en refusant toute transition non prévue (§5).
 *
 * Chaque passage porte ses effets : horodatage, contrôle de complétude, et
 * versement de la machine au parc du client à la restitution.
 */
export async function changeRepairStatus(
	id: number,
	to: RepairStatus,
	options: { onHoldPartLabel?: string | null; onHoldExpectedAt?: Date | null } = {}
) {
	const [current] = await db.select().from(repairOrder).where(eq(repairOrder.id, id)).limit(1);
	if (!current) throw new RepairError('Ordre introuvable.');

	if (!canTransition(current.status, to)) {
		throw new RepairError(
			`Transition refusée : « ${REPAIR_STATUS_LABELS[current.status]} » ne mène pas à « ${REPAIR_STATUS_LABELS[to]} ».`
		);
	}

	// R12 : la description des travaux conditionne l'achèvement.
	if (to === 'completed' && !current.workDescription?.trim()) {
		throw new RepairError(
			'La description des travaux est obligatoire avant de marquer l’ordre comme achevé.'
		);
	}

	// R13 : une suspension indique la pièce attendue et la date prévue.
	if (to === 'on_hold' && !options.onHoldPartLabel?.trim()) {
		throw new RepairError('Indiquez la pièce attendue avant de suspendre les travaux.');
	}

	const now = new Date();
	await db
		.update(repairOrder)
		.set({
			status: to,
			updatedAt: now,
			...(to === 'in_progress' && !current.startedAt ? { startedAt: now } : {}),
			...(to === 'completed' ? { completedAt: now } : {}),
			...(to === 'delivered' ? { deliveredAt: now } : {}),
			...(to === 'on_hold'
				? {
						onHoldPartLabel: options.onHoldPartLabel?.trim() ?? null,
						onHoldExpectedAt: options.onHoldExpectedAt ?? null
					}
				: {}),
			// Les travaux reprennent : l'attente n'a plus lieu d'être.
			...(to === 'in_progress' ? { onHoldPartLabel: null, onHoldExpectedAt: null } : {})
		})
		.where(eq(repairOrder.id, id));

	// R21 : la machine rejoint le parc du client à la restitution.
	if (to === 'delivered') await addMachineToFleet(id);
}

/** Enregistre le règlement (R19) — hors transition d'état. */
export async function markRepairPaid(id: number) {
	await db
		.update(repairOrder)
		.set({ paidAt: new Date(), updatedAt: new Date() })
		.where(eq(repairOrder.id, id));
}

/**
 * Verse la machine au parc du client, si elle n'y figure pas déjà (R21).
 *
 * Le rapprochement se fait sur le numéro de série, seul identifiant fiable
 * d'une machine ; à défaut, sur le couple marque + modèle.
 */
async function addMachineToFleet(repairOrderId: number) {
	const [order] = await db
		.select()
		.from(repairOrder)
		.where(eq(repairOrder.id, repairOrderId))
		.limit(1);

	if (!order || order.machineAddedToFleet) return;
	// Sans identification, il n'y a rien à verser au parc.
	if (!order.machineBrand && !order.machineModel && !order.serialNumber) return;

	const existing = await db
		.select({ id: clientMachine.id })
		.from(clientMachine)
		.where(
			and(
				eq(clientMachine.customerId, order.customerId),
				order.serialNumber
					? eq(clientMachine.serialNumber, order.serialNumber)
					: and(
							eq(clientMachine.brand, order.machineBrand ?? ''),
							eq(clientMachine.model, order.machineModel ?? '')
						)
			)
		)
		.limit(1);

	if (existing.length === 0) {
		await db.insert(clientMachine).values({
			customerId: order.customerId,
			name: [order.machineBrand, order.machineModel].filter(Boolean).join(' ') || 'Machine',
			// Le parc exige un type d'équipement ; l'atelier ne le renseigne pas
			// toujours, d'où ce repli plutôt qu'un refus de versement.
			equipmentType: order.machineType?.trim() || 'Autre',
			brand: order.machineBrand,
			model: order.machineModel,
			serialNumber: order.serialNumber,
			engineModel: order.engineModel,
			engineSerialNumber: order.engineSerialNumber,
			status: 'confirmed',
			source: 'repair_order',
			repairOrderId: order.id,
			confirmedAt: new Date()
		});
	}

	await db
		.update(repairOrder)
		.set({ machineAddedToFleet: true })
		.where(eq(repairOrder.id, repairOrderId));
}

/** Ordres d'un client, pour son espace personnel. */
export function listCustomerRepairs(customerId: number) {
	return db
		.select({
			id: repairOrder.id,
			reference: repairOrder.reference,
			status: repairOrder.status,
			orderType: repairOrder.orderType,
			machineBrand: repairOrder.machineBrand,
			machineModel: repairOrder.machineModel,
			totalTtc: repairOrder.totalTtc,
			createdAt: repairOrder.createdAt,
			deliveredAt: repairOrder.deliveredAt
		})
		.from(repairOrder)
		.where(eq(repairOrder.customerId, customerId))
		.orderBy(desc(repairOrder.createdAt));
}

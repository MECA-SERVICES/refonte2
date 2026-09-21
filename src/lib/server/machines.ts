/**
 * Parc machines client — CDC section 32.
 *
 * Toutes les opérations sont bornées au client propriétaire (R1) : l'identifiant
 * du client vient de la session, jamais du formulaire.
 */

import { and, asc, desc, eq, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { db } from './db';
import { clientMachine, type MachineSource, type NewClientMachine } from './db/machine.schema';
import { order, orderLine, orderState } from './db/order.schema';
import { product } from './db/catalog.schema';
import { formFields, type ParseResult } from './forms';

/** Délai au terme duquel une proposition non confirmée est retirée (R14). */
const PENDING_EXPIRY_MONTHS = 6;

/** Types d'équipement proposés à la saisie. */
export const EQUIPMENT_TYPES = [
	'Tondeuse',
	'Tracteur tondeuse',
	'Robot de tonte',
	'Débroussailleuse',
	'Tronçonneuse',
	'Taille-haie',
	'Souffleur',
	'Motoculteur',
	'Nettoyeur haute pression',
	'Broyeur',
	'Groupe électrogène',
	'Autre'
] as const;

// ===========================================================================
// Lecture
// ===========================================================================

/**
 * Parc d'un client.
 *
 * Les machines à compléter remontent en tête : ce sont celles qui appellent une
 * action (R11).
 */
export function listMachines(customerId: number, search?: string) {
	const conditions = [eq(clientMachine.customerId, customerId)];

	const term = search?.trim();
	if (term) {
		// Une seule saisie interroge les champs par lesquels on identifie une
		// machine : son nom d'usage, son modèle ou son numéro de série.
		const like = `%${term}%`;
		conditions.push(
			sql`(
				${clientMachine.name} ILIKE ${like}
				OR ${clientMachine.brand} ILIKE ${like}
				OR ${clientMachine.model} ILIKE ${like}
				OR ${clientMachine.serialNumber} ILIKE ${like}
				OR ${clientMachine.equipmentType} ILIKE ${like}
			)`
		);
	}

	return db
		.select()
		.from(clientMachine)
		.where(and(...conditions))
		.orderBy(
			// `pending_confirmation` précède `confirmed` dans l'ordre alphabétique :
			// le tri naturel place donc les machines à compléter en premier.
			asc(clientMachine.status),
			desc(clientMachine.createdAt)
		);
}

/** Machine du parc, si elle appartient bien au client (R1). */
export async function getMachine(customerId: number, machineId: number) {
	const [row] = await db
		.select()
		.from(clientMachine)
		.where(and(eq(clientMachine.id, machineId), eq(clientMachine.customerId, customerId)))
		.limit(1);
	return row;
}

/** Machines confirmées, seules retenues pour la compatibilité des pièces (R11). */
export function listConfirmedMachines(customerId: number) {
	return db
		.select({
			id: clientMachine.id,
			name: clientMachine.name,
			brand: clientMachine.brand,
			model: clientMachine.model,
			serialNumber: clientMachine.serialNumber
		})
		.from(clientMachine)
		.where(and(eq(clientMachine.customerId, customerId), eq(clientMachine.status, 'confirmed')))
		.orderBy(asc(clientMachine.name));
}

// ===========================================================================
// Écriture
// ===========================================================================

export class MachineError extends Error {}

/**
 * Vérifie qu'un numéro de série n'est pas déjà employé dans le parc (R17, R18).
 *
 * Le contrôle double l'index unique : il permet un message clair plutôt qu'une
 * erreur de contrainte remontée brute.
 */
async function assertSerialAvailable(
	customerId: number,
	serialNumber: string | null,
	exceptId?: number
) {
	if (!serialNumber) return;

	const conditions = [
		eq(clientMachine.customerId, customerId),
		eq(clientMachine.serialNumber, serialNumber)
	];
	if (exceptId) conditions.push(ne(clientMachine.id, exceptId));

	const [taken] = await db
		.select({ id: clientMachine.id, name: clientMachine.name })
		.from(clientMachine)
		.where(and(...conditions))
		.limit(1);

	if (taken) {
		throw new MachineError(
			`Le numéro de série « ${serialNumber} » est déjà enregistré sur « ${taken.name} ».`
		);
	}
}

/** Ajout manuel : la machine entre directement au statut confirmé (R6). */
export async function createMachine(customerId: number, values: MachineInput) {
	await assertSerialAvailable(customerId, values.serialNumber);

	const [row] = await db
		.insert(clientMachine)
		.values({
			...values,
			customerId,
			status: 'confirmed',
			source: 'manual',
			confirmedAt: new Date()
		})
		.returning();
	return row;
}

/** Modification, possible avant comme après confirmation (R19). */
export async function updateMachine(customerId: number, machineId: number, values: MachineInput) {
	const owned = await getMachine(customerId, machineId);
	if (!owned) return undefined;

	await assertSerialAvailable(customerId, values.serialNumber, machineId);

	const [row] = await db
		.update(clientMachine)
		.set({ ...values, updatedAt: new Date() })
		.where(and(eq(clientMachine.id, machineId), eq(clientMachine.customerId, customerId)))
		.returning();
	return row;
}

/**
 * Confirme une machine proposée automatiquement (R12).
 *
 * Le numéro de série est exigé ici : c'est précisément ce que la proposition
 * laissait en attente (R10).
 */
export async function confirmMachine(
	customerId: number,
	machineId: number,
	values: { serialNumber: string; name?: string }
) {
	const owned = await getMachine(customerId, machineId);
	if (!owned) return undefined;

	await assertSerialAvailable(customerId, values.serialNumber, machineId);

	const [row] = await db
		.update(clientMachine)
		.set({
			serialNumber: values.serialNumber,
			...(values.name ? { name: values.name } : {}),
			status: 'confirmed',
			confirmedAt: new Date(),
			updatedAt: new Date()
		})
		.where(and(eq(clientMachine.id, machineId), eq(clientMachine.customerId, customerId)))
		.returning();
	return row;
}

/**
 * Retire une machine du parc.
 *
 * Sert aussi au refus d'une proposition automatique (R13) : dans les deux cas,
 * seule l'entrée du parc disparaît — commandes et ordres de réparation sont
 * intacts (R20).
 */
export async function deleteMachine(customerId: number, machineId: number) {
	const owned = await getMachine(customerId, machineId);
	if (!owned) return false;

	await db
		.delete(clientMachine)
		.where(and(eq(clientMachine.id, machineId), eq(clientMachine.customerId, customerId)));
	return true;
}

// ===========================================================================
// Alimentation automatique
// ===========================================================================

/**
 * Crée les propositions correspondant à une commande livrée (R7).
 *
 * Seuls les articles reconnus comme machines sont retenus : une commande de
 * bougies n'a pas à peupler le parc. Une ligne de quantité supérieure à un
 * produit autant d'entrées que d'exemplaires (R16).
 */
export async function proposeMachinesFromOrder(orderId: number): Promise<number> {
	const lines = await db
		.select({
			orderLineId: orderLine.id,
			productId: orderLine.productId,
			productName: orderLine.productName,
			quantity: orderLine.quantity,
			customerId: order.customerId,
			brandName: product.brandId,
			weightKg: product.weightKg
		})
		.from(orderLine)
		.innerJoin(order, eq(orderLine.orderId, order.id))
		.leftJoin(product, eq(orderLine.productId, product.id))
		.where(eq(orderLine.orderId, orderId));

	let created = 0;

	for (const line of lines) {
		const equipmentType = guessEquipmentType(line.productName);
		// Sans type reconnaissable, l'article n'est pas une machine.
		if (!equipmentType) continue;

		// R15 — une proposition existe déjà pour cette ligne : on ne double pas.
		const [existing] = await db
			.select({ id: clientMachine.id })
			.from(clientMachine)
			.where(eq(clientMachine.orderLineId, line.orderLineId))
			.limit(1);
		if (existing) continue;

		const rows: NewClientMachine[] = Array.from({ length: line.quantity }, () => ({
			customerId: line.customerId,
			// R9 — le nom d'usage reprend la désignation, modifiable ensuite.
			name: line.productName,
			equipmentType,
			model: line.productName,
			status: 'pending_confirmation',
			source: 'order' satisfies MachineSource,
			productId: line.productId,
			orderId,
			orderLineId: line.orderLineId
		}));

		await db.insert(clientMachine).values(rows);
		created += rows.length;
	}

	return created;
}

/**
 * Reconnaît le type d'équipement depuis la désignation d'un article.
 *
 * Heuristique volontairement prudente : mieux vaut ne rien proposer qu'encombrer
 * le parc d'un client avec des consommables.
 */
export function guessEquipmentType(productName: string): string | null {
	const name = productName.toLowerCase();

	// Un article de rechange porte souvent le nom de la machine : on l'écarte
	// avant toute reconnaissance.
	if (/\b(kit|filtre|bougie|courroie|lame|carburateur|joint|roulement|câble|vis)\b/.test(name)) {
		return null;
	}

	const rules: [RegExp, string][] = [
		[/tracteur\s*tondeuse|autoport/, 'Tracteur tondeuse'],
		[/robot\s*(de\s*)?tonte/, 'Robot de tonte'],
		[/tondeuse/, 'Tondeuse'],
		[/d[ée]brouss/, 'Débroussailleuse'],
		[/tron[çc]onneuse/, 'Tronçonneuse'],
		[/taille[-\s]?haie/, 'Taille-haie'],
		[/souffleur/, 'Souffleur'],
		[/motocult/, 'Motoculteur'],
		[/nettoyeur|karcher/, 'Nettoyeur haute pression'],
		[/broyeur/, 'Broyeur'],
		[/groupe\s*[ée]lectrog/, 'Groupe électrogène']
	];

	for (const [pattern, type] of rules) {
		if (pattern.test(name)) return type;
	}
	return null;
}

/**
 * Retire les propositions restées sans réponse (R14).
 *
 * Destiné à une exécution périodique ; retourne le nombre d'entrées retirées.
 */
export async function purgeExpiredProposals(): Promise<number> {
	const limit = new Date();
	limit.setMonth(limit.getMonth() - PENDING_EXPIRY_MONTHS);

	const removed = await db
		.delete(clientMachine)
		.where(
			and(eq(clientMachine.status, 'pending_confirmation'), lt(clientMachine.createdAt, limit))
		)
		.returning({ id: clientMachine.id });

	return removed.length;
}

/** Commandes livrées dont le parc n'a pas encore été alimenté. */
export function listDeliveredOrdersToProcess(limit = 100) {
	return db
		.select({ id: order.id })
		.from(order)
		.innerJoin(orderState, eq(order.stateId, orderState.id))
		.where(and(isNotNull(order.deliveredAt), eq(orderState.isShipped, true)))
		.orderBy(desc(order.deliveredAt))
		.limit(limit);
}

// ===========================================================================
// Formulaires
// ===========================================================================

/** Champs modifiables d'une machine. */
export type MachineInput = {
	name: string;
	equipmentType: string;
	brand: string | null;
	model: string | null;
	serialNumber: string | null;
	engineModel: string | null;
	engineSerialNumber: string | null;
	warrantyInfo: string | null;
	warrantyEndDate: Date | null;
	imageUrl: string | null;
	notes: string | null;
};

export function parseMachineForm(form: FormData): ParseResult<MachineInput> {
	const { str } = formFields(form);

	// R4 — seuls le nom d'usage et le type sont exigés.
	const name = str('name');
	const equipmentType = str('equipmentType');
	if (!name) return { ok: false, error: "Le nom d'usage est obligatoire." };
	if (!equipmentType) return { ok: false, error: "Le type d'équipement est obligatoire." };

	const rawDate = str('warrantyEndDate');
	const warrantyEndDate = rawDate ? new Date(rawDate) : null;

	return {
		ok: true,
		values: {
			name,
			equipmentType,
			brand: str('brand'),
			model: str('model'),
			serialNumber: str('serialNumber'),
			engineModel: str('engineModel'),
			engineSerialNumber: str('engineSerialNumber'),
			warrantyInfo: str('warrantyInfo'),
			warrantyEndDate:
				warrantyEndDate && !Number.isNaN(warrantyEndDate.getTime()) ? warrantyEndDate : null,
			imageUrl: str('imageUrl'),
			notes: str('notes')
		}
	};
}

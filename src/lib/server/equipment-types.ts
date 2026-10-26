/**
 * Types de matériel gérés en back-office (demande client 4.3).
 *
 * Proposés à la saisie du parc client et des ordres de réparation. Les fiches
 * portent le libellé en texte (`client_machine.equipment_type`,
 * `repair_order.machine_type`) : un renommage y est reporté, une désactivation
 * les laisse intactes.
 */
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { clientMachine, equipmentType } from '$lib/server/db/machine.schema';
import { repairOrder } from '$lib/server/db/repair.schema';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class EquipmentTypeError extends Error {}

/** Libellés proposés à la saisie, dans l'ordre choisi en back-office. */
export async function activeEquipmentTypeNames(): Promise<string[]> {
	const rows = await db
		.select({ name: equipmentType.name })
		.from(equipmentType)
		.where(eq(equipmentType.isActive, true))
		.orderBy(asc(equipmentType.position), asc(equipmentType.id));
	return rows.map((r) => r.name);
}

/**
 * Tous les types, avec le nombre de fiches qui les portent : machines du parc
 * client et ordres de réparation.
 */
export function listEquipmentTypes() {
	return db
		.select({
			id: equipmentType.id,
			name: equipmentType.name,
			position: equipmentType.position,
			isActive: equipmentType.isActive,
			machines: sql<number>`(select count(*)::int from ${clientMachine} where ${clientMachine.equipmentType} = ${equipmentType.name})`,
			repairs: sql<number>`(select count(*)::int from ${repairOrder} where ${repairOrder.machineType} = ${equipmentType.name})`
		})
		.from(equipmentType)
		.orderBy(asc(equipmentType.position), asc(equipmentType.id));
}

/** Refuse un libellé vide ou déjà pris, à la casse près. */
async function assertNameAvailable(name: string, exceptId?: number) {
	if (!name) throw new EquipmentTypeError('Indiquez le nom du type de matériel.');
	const [taken] = await db
		.select({ id: equipmentType.id })
		.from(equipmentType)
		.where(sql`lower(${equipmentType.name}) = lower(${name})`)
		.limit(1);
	if (taken && taken.id !== exceptId) {
		throw new EquipmentTypeError(`Le type « ${name} » existe déjà.`);
	}
}

/** Ajoute un type en fin de liste. */
export async function createEquipmentType(rawName: string) {
	const name = rawName.trim();
	await assertNameAvailable(name);
	const [{ last }] = await db
		.select({ last: sql<number>`coalesce(max(${equipmentType.position}), 0)::int` })
		.from(equipmentType);
	await db.insert(equipmentType).values({ name, position: last + 10 });
}

/** Renomme un type, et reporte le nouveau libellé sur les fiches qui le portent. */
export async function renameEquipmentType(id: number, rawName: string) {
	const name = rawName.trim();
	await assertNameAvailable(name, id);

	await db.transaction(async (tx) => {
		const [current] = await tx
			.select({ name: equipmentType.name })
			.from(equipmentType)
			.where(eq(equipmentType.id, id))
			.for('update');
		if (!current) throw new EquipmentTypeError('Type introuvable.');
		if (current.name === name) return;

		await tx.update(equipmentType).set({ name }).where(eq(equipmentType.id, id));
		await tx
			.update(clientMachine)
			.set({ equipmentType: name })
			.where(eq(clientMachine.equipmentType, current.name));
		await tx
			.update(repairOrder)
			.set({ machineType: name })
			.where(eq(repairOrder.machineType, current.name));
	});
}

/** Active ou désactive un type ; les fiches qui le portent ne changent pas. */
export async function setEquipmentTypeActive(id: number, isActive: boolean) {
	await db.update(equipmentType).set({ isActive }).where(eq(equipmentType.id, id));
}

/** Échange la position d'un type avec son voisin du dessus ou du dessous. */
export async function moveEquipmentType(id: number, direction: 'up' | 'down') {
	await db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: equipmentType.id, position: equipmentType.position })
			.from(equipmentType)
			.orderBy(asc(equipmentType.position), asc(equipmentType.id))
			.for('update');

		const index = rows.findIndex((r) => r.id === id);
		const neighbour = rows[direction === 'up' ? index - 1 : index + 1];
		if (index === -1 || !neighbour) return;

		// Positions renumérotées de 10 en 10 : deux types ne partagent jamais
		// la même, l'échange est toujours visible.
		const order = rows.map((r) => r.id);
		[order[index], order[direction === 'up' ? index - 1 : index + 1]] = [neighbour.id, id];
		for (const [i, typeId] of order.entries()) {
			await tx
				.update(equipmentType)
				.set({ position: (i + 1) * 10 })
				.where(eq(equipmentType.id, typeId));
		}
	});
}

/** Supprime un type que plus aucune fiche ne porte ; sinon, le désactiver. */
export async function deleteEquipmentType(id: number) {
	const [row] = (await listEquipmentTypes()).filter((t) => t.id === id);
	if (!row) throw new EquipmentTypeError('Type introuvable.');
	if (row.machines + row.repairs > 0) {
		throw new EquipmentTypeError(
			`« ${row.name} » est utilisé par ${row.machines + row.repairs} fiche(s) : désactivez-le plutôt.`
		);
	}
	await db.delete(equipmentType).where(eq(equipmentType.id, id));
}

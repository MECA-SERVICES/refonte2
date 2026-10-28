/**
 * Inventaire annuel, repris du module Dolibarr « UTILE » (`dep/inventaire/`) :
 *
 * 1. une campagne (« INVENTAIRE 2026 ») ;
 * 2. on compte par emplacement : produit (référence, EAN ou nom), quantité,
 *    état, numéro de série, note ; le prix d'achat est figé au comptage et
 *    valorise l'inventaire ;
 * 3. on compare au stock, on exporte pour le comptable ;
 * 4. on valide : le stock devient ce qui a été compté. UTILE remplaçait le
 *    stock d'un bloc ; ici, chaque écart passe par un mouvement d'ajustement,
 *    tracé comme les autres.
 */
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { brand, product, productStock, stockSerial, taxRule } from '$lib/server/db/catalog.schema';
import { inventory, inventoryCount, inventorySerial } from '$lib/server/db/inventory.schema';
import { priceTtcSql, thumbnailWithBrandFallbackSql } from '$lib/server/pricing';
import { listStockLocations, recordStockMovements } from '$lib/server/stock-locations';
import { inventoryGaps, type InventoryScope } from '$lib/inventory';
import { isStockCondition, type StockConditionValue } from '$lib/stock-locations';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class InventoryError extends Error {}

/** Valeur d'achat d'une campagne : quantité × prix d'achat figé. */
const valueSql = sql<string>`coalesce(sum(${inventoryCount.quantity} * coalesce(${inventoryCount.purchasePrice}, 0)), 0)::text`;

/** Campagnes, la plus récente d'abord, avec leurs totaux. */
export async function listInventories() {
	return db
		.select({
			id: inventory.id,
			name: inventory.name,
			status: inventory.status,
			createdAt: inventory.createdAt,
			validatedAt: inventory.validatedAt,
			legacyDoliId: inventory.legacyDoliId,
			lines: sql<number>`count(${inventoryCount.id})::int`,
			products: sql<number>`count(distinct ${inventoryCount.productId})::int`,
			units: sql<number>`coalesce(sum(${inventoryCount.quantity}), 0)::int`,
			value: valueSql
		})
		.from(inventory)
		.leftJoin(inventoryCount, eq(inventoryCount.inventoryId, inventory.id))
		.groupBy(inventory.id)
		.orderBy(desc(inventory.createdAt));
}

export async function createInventory(rawName: string) {
	const name = rawName.replace(/\s+/g, ' ').trim();
	if (!name) throw new InventoryError("Donnez un nom à l'inventaire, ex. « INVENTAIRE 2026 ».");
	const [row] = await db.insert(inventory).values({ name }).returning({ id: inventory.id });
	return row.id;
}

/** Une campagne et ses totaux (achat HT figé, vente TTC actuelle). */
export async function getInventory(id: number) {
	const [row] = await db
		.select({
			id: inventory.id,
			name: inventory.name,
			status: inventory.status,
			createdAt: inventory.createdAt,
			validatedAt: inventory.validatedAt,
			legacyDoliId: inventory.legacyDoliId,
			lines: sql<number>`count(${inventoryCount.id})::int`,
			products: sql<number>`count(distinct ${inventoryCount.productId})::int`,
			units: sql<number>`coalesce(sum(${inventoryCount.quantity}), 0)::int`,
			value: valueSql
		})
		.from(inventory)
		.leftJoin(inventoryCount, eq(inventoryCount.inventoryId, inventory.id))
		.where(eq(inventory.id, id))
		.groupBy(inventory.id);
	return row ?? null;
}

async function requireOpen(id: number) {
	const [row] = await db
		.select({ status: inventory.status })
		.from(inventory)
		.where(eq(inventory.id, id));
	if (!row) throw new InventoryError('Inventaire introuvable.');
	if (row.status !== 'open')
		throw new InventoryError('Cet inventaire est validé : il ne se modifie plus.');
}

/** Lignes comptées, avec photo, prix et numéros de série. */
export async function listCounts(inventoryId: number) {
	return db
		.select({
			id: inventoryCount.id,
			productId: inventoryCount.productId,
			name: product.name,
			reference: product.reference,
			ean13: product.ean13,
			brandName: brand.name,
			imageUrl: thumbnailWithBrandFallbackSql,
			locationId: inventoryCount.locationId,
			condition: inventoryCount.condition,
			quantity: inventoryCount.quantity,
			purchasePrice: inventoryCount.purchasePrice,
			priceTtc: priceTtcSql,
			note: inventoryCount.note,
			updatedAt: inventoryCount.updatedAt,
			serials: sql<{ id: number; serial: string }[]>`(
				select coalesce(json_agg(json_build_object('id', s.id, 'serial', s.serial_number)
					order by s.serial_number), '[]'::json)
				from ${inventorySerial} s where s.inventory_count_id = ${inventoryCount}.id)`
		})
		.from(inventoryCount)
		.innerJoin(product, eq(product.id, inventoryCount.productId))
		.leftJoin(brand, eq(brand.id, product.brandId))
		.leftJoin(taxRule, eq(taxRule.id, product.taxRuleId))
		.where(eq(inventoryCount.inventoryId, inventoryId))
		.orderBy(desc(inventoryCount.updatedAt));
}

/**
 * Produits à compter : tout le catalogue, en ligne ou non. Un EAN complet
 * cherche l'EAN exact (lecture à la douchette) ; sinon chaque mot doit
 * apparaître dans le nom, la référence ou l'EAN.
 */
export async function searchCountableProducts(term: string, limit = 20) {
	const q = term.trim();
	if (q.length < 2) return [];
	const where = /^\d{8,13}$/.test(q)
		? or(eq(product.ean13, q), eq(product.reference, q))
		: and(
				...q
					.split(/\s+/)
					.map((w) =>
						or(
							ilike(product.name, `%${w}%`),
							ilike(product.reference, `%${w}%`),
							ilike(product.ean13, `%${w}%`)
						)
					)
			);
	return db
		.select({
			productId: product.id,
			name: product.name,
			reference: product.reference,
			ean13: product.ean13,
			isActive: product.isActive,
			brandName: brand.name,
			imageUrl: thumbnailWithBrandFallbackSql,
			purchasePrice: product.purchasePrice,
			stock: product.stock,
			placements: sql<{ locationId: number; condition: string; quantity: number }[]>`(
				select coalesce(json_agg(json_build_object(
					'locationId', s.location_id, 'condition', s.condition, 'quantity', s.quantity)
					order by s.quantity desc), '[]'::json)
				from ${productStock} s where s.product_id = ${product}.id and s.quantity <> 0)`
		})
		.from(product)
		.leftJoin(brand, eq(brand.id, product.brandId))
		.where(where)
		.orderBy(desc(product.stock), asc(product.name))
		.limit(limit);
}

export type CountInput = {
	inventoryId: number;
	productId: number;
	locationId: number;
	condition: StockConditionValue;
	/** Ajouté au comptage déjà saisi, comme dans UTILE (négatif : on retire). */
	quantity: number;
	serialNumber: string | null;
	note: string | null;
	countedBy: string | null;
};

/** Formulaire « Compter » : produit, emplacement, état, quantité, n° de série, note. */
export function parseCountForm(form: FormData, inventoryId: number, countedBy: string | null) {
	const condition = String(form.get('condition') ?? 'new');
	const input: CountInput = {
		inventoryId,
		productId: Number(form.get('productId')),
		locationId: Number(form.get('locationId')),
		condition: isStockCondition(condition) ? condition : 'new',
		quantity: Number(form.get('quantity') ?? 1),
		serialNumber: form.get('serialNumber')?.toString().trim() || null,
		note: form.get('note')?.toString().trim() || null,
		countedBy
	};
	if (!Number.isInteger(input.productId) || input.productId <= 0) {
		throw new InventoryError('Choisissez le produit compté.');
	}
	if (!Number.isInteger(input.locationId) || input.locationId <= 0) {
		throw new InventoryError("Choisissez l'emplacement compté.");
	}
	if (!Number.isInteger(input.quantity) || input.quantity === 0) {
		throw new InventoryError('La quantité doit être un nombre entier non nul.');
	}
	if (input.serialNumber && input.quantity !== 1) {
		throw new InventoryError('Un numéro de série se compte pièce par pièce (quantité 1).');
	}
	return input;
}

/**
 * Ajoute un comptage : la quantité s'ajoute à la ligne (produit, emplacement,
 * état), créée au premier comptage avec le prix d'achat du moment.
 */
export async function addCount(input: CountInput) {
	await requireOpen(input.inventoryId);
	await db.transaction(async (tx) => {
		const [{ purchasePrice }] = await tx
			.select({ purchasePrice: product.purchasePrice })
			.from(product)
			.where(eq(product.id, input.productId));
		const [line] = await tx
			.insert(inventoryCount)
			.values({
				inventoryId: input.inventoryId,
				productId: input.productId,
				locationId: input.locationId,
				condition: input.condition,
				quantity: input.quantity,
				purchasePrice,
				note: input.note,
				countedBy: input.countedBy
			})
			.onConflictDoUpdate({
				target: [
					inventoryCount.inventoryId,
					inventoryCount.productId,
					inventoryCount.locationId,
					inventoryCount.condition
				],
				set: {
					quantity: sql`${inventoryCount.quantity} + ${input.quantity}`,
					note: sql`coalesce(${input.note}, ${inventoryCount.note})`,
					countedBy: input.countedBy,
					updatedAt: new Date()
				}
			})
			.returning({ id: inventoryCount.id, quantity: inventoryCount.quantity });
		if (line.quantity < 0) throw new InventoryError('Le comptage ne peut pas devenir négatif.');
		if (input.serialNumber) {
			const added = await tx.execute(sql`
				INSERT INTO ${inventorySerial} (inventory_count_id, serial_number)
				VALUES (${line.id}, ${input.serialNumber})
				ON CONFLICT DO NOTHING RETURNING id`);
			if (!added.length) {
				throw new InventoryError(`Le n° de série ${input.serialNumber} est déjà compté ici.`);
			}
		}
		await assertSerialsFit(tx, line.id);
		if (line.quantity === 0) await tx.delete(inventoryCount).where(eq(inventoryCount.id, line.id));
	});
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Une ligne ne compte pas plus de numéros de série que de pièces. */
async function assertSerialsFit(tx: Tx, lineId: number) {
	const [row] = await tx
		.select({
			quantity: inventoryCount.quantity,
			serials: sql<number>`(select count(*)::int from ${inventorySerial} s where s.inventory_count_id = ${inventoryCount}.id)`
		})
		.from(inventoryCount)
		.where(eq(inventoryCount.id, lineId));
	if (row && row.serials > row.quantity) {
		throw new InventoryError(
			`Cette ligne compte ${row.serials} numéros de série : la quantité ne peut pas descendre sous ${row.serials}.`
		);
	}
}

/** Corrige la quantité d'une ligne (0 la supprime). */
export async function setCountQuantity(inventoryId: number, lineId: number, quantity: number) {
	await requireOpen(inventoryId);
	if (!Number.isInteger(quantity) || quantity < 0) {
		throw new InventoryError('La quantité doit être un nombre entier positif ou nul.');
	}
	await db.transaction(async (tx) => {
		const line = and(eq(inventoryCount.id, lineId), eq(inventoryCount.inventoryId, inventoryId));
		if (quantity === 0) {
			await tx.delete(inventoryCount).where(line);
			return;
		}
		await tx.update(inventoryCount).set({ quantity, updatedAt: new Date() }).where(line);
		await assertSerialsFit(tx, lineId);
	});
}

/** Retire un numéro de série compté (la quantité de la ligne baisse d'autant). */
export async function removeCountSerial(inventoryId: number, serialId: number) {
	await requireOpen(inventoryId);
	await db.transaction(async (tx) => {
		const [serial] = await tx
			.delete(inventorySerial)
			.where(eq(inventorySerial.id, serialId))
			.returning({ lineId: inventorySerial.inventoryCountId });
		if (!serial) return;
		const [line] = await tx
			.update(inventoryCount)
			.set({ quantity: sql`${inventoryCount.quantity} - 1`, updatedAt: new Date() })
			.where(and(eq(inventoryCount.id, serial.lineId), eq(inventoryCount.inventoryId, inventoryId)))
			.returning({ quantity: inventoryCount.quantity });
		if (line && line.quantity <= 0) {
			await tx.delete(inventoryCount).where(eq(inventoryCount.id, serial.lineId));
		}
	});
}

/** Écarts entre le comptage et le stock actuel, dans la portée choisie. */
export async function getInventoryGaps(inventoryId: number, scope: InventoryScope) {
	const counts = await db
		.select({
			productId: inventoryCount.productId,
			locationId: inventoryCount.locationId,
			condition: inventoryCount.condition,
			quantity: inventoryCount.quantity
		})
		.from(inventoryCount)
		.where(eq(inventoryCount.inventoryId, inventoryId));
	const countedLocations = [...new Set(counts.map((c) => c.locationId))];
	const stock = await db
		.select({
			productId: productStock.productId,
			locationId: productStock.locationId,
			condition: productStock.condition,
			quantity: productStock.quantity
		})
		.from(productStock)
		.where(
			and(
				ne(productStock.quantity, 0),
				scope === 'all'
					? undefined
					: countedLocations.length
						? inArray(productStock.locationId, countedLocations)
						: sql`false`
			)
		);
	const gaps = inventoryGaps(counts, stock, scope);
	if (!gaps.length) return [];
	const names = await db
		.select({ id: product.id, name: product.name, reference: product.reference })
		.from(product)
		.where(inArray(product.id, [...new Set(gaps.map((g) => g.productId))]));
	const byId = new Map(names.map((n) => [n.id, n]));
	return gaps.map((g) => ({
		...g,
		name: byId.get(g.productId)?.name ?? '—',
		reference: byId.get(g.productId)?.reference ?? ''
	}));
}

/**
 * Valide l'inventaire : chaque écart devient un mouvement d'ajustement, puis
 * les numéros de série en stock deviennent ceux qui ont été comptés. Tout ou
 * rien ; la campagne passe ensuite en lecture seule.
 */
export async function validateInventory(id: number, scope: InventoryScope, userId: string | null) {
	await requireOpen(id);
	const [header] = await db
		.select({ name: inventory.name })
		.from(inventory)
		.where(eq(inventory.id, id));
	const gaps = await getInventoryGaps(id, scope);
	const counted = await db
		.select({ locationId: inventoryCount.locationId, productId: inventoryCount.productId })
		.from(inventoryCount)
		.where(eq(inventoryCount.inventoryId, id));
	const products = [
		...new Set([...gaps.map((g) => g.productId), ...counted.map((c) => c.productId)])
	];
	const locations = [...new Set(counted.map((c) => c.locationId))];

	await recordStockMovements(
		gaps.map((g) => ({
			productId: g.productId,
			locationId: g.locationId,
			condition: g.condition as StockConditionValue,
			quantity: g.delta,
			type: 'adjustment' as const,
			reference: header.name,
			note: `Inventaire : ${g.current} en stock, ${g.counted} compté(s)`,
			createdBy: userId
		})),
		// Avant : les numéros en stock dans la portée sortent, pour que les
		// ajustements ne butent pas sur la règle « pas plus de numéros que de pièces ».
		async (tx) => {
			if (!products.length) return;
			await tx
				.update(stockSerial)
				.set({ locationId: null, updatedAt: new Date() })
				.where(
					and(
						inArray(stockSerial.productId, products),
						scope === 'all'
							? sql`${stockSerial.locationId} is not null`
							: locations.length
								? inArray(stockSerial.locationId, locations)
								: sql`false`
					)
				);
		},
		// Après : les numéros comptés reprennent place, à leur emplacement et état.
		async (tx) => {
			await tx.execute(sql`
				INSERT INTO ${stockSerial} (product_id, serial_number, location_id, condition)
				SELECT c.product_id, s.serial_number, c.location_id, c.condition
				FROM ${inventorySerial} s JOIN ${inventoryCount} c ON c.id = s.inventory_count_id
				WHERE c.inventory_id = ${id}
				ON CONFLICT (product_id, upper(serial_number))
				DO UPDATE SET location_id = excluded.location_id, condition = excluded.condition,
					updated_at = now()`);
			await tx
				.update(inventory)
				.set({
					status: 'validated',
					validatedAt: new Date(),
					validatedBy: userId,
					updatedAt: new Date()
				})
				.where(eq(inventory.id, id));
		}
	);
	return gaps.length;
}

/**
 * Export pour le comptable, en CSV (séparateur `;`, Excel) : une ligne par
 * produit, emplacement et état, valorisée au prix d'achat figé.
 */
export async function exportInventoryCsv(id: number) {
	const [rows, locations] = await Promise.all([listCounts(id), listStockLocations()]);
	const byId = new Map(locations.map((l) => [l.id, l]));
	const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
	const money = (n: number) => n.toFixed(2).replace('.', ',');
	const lines = [
		[
			'reference',
			'designation',
			'ean',
			'emplacement',
			'code',
			'etat',
			'quantite',
			'prix_achat_ht',
			'total_achat_ht',
			'prix_vente_ttc',
			'numeros_serie',
			'note'
		]
			.map(cell)
			.join(';'),
		...rows
			.sort((a, b) => a.reference.localeCompare(b.reference))
			.map((r) => {
				const l = byId.get(r.locationId);
				const price = Number(r.purchasePrice ?? 0);
				return [
					r.reference,
					r.name,
					r.ean13,
					l?.path,
					l?.code,
					r.condition === 'used' ? 'Occasion' : r.condition === 'warranty' ? 'Garantie' : 'Neuf',
					r.quantity,
					money(price),
					money(price * r.quantity),
					money(Number(r.priceTtc ?? 0)),
					r.serials.map((s) => s.serial).join(' '),
					r.note
				]
					.map(cell)
					.join(';');
			})
	];
	return '﻿' + lines.join('\n') + '\n';
}

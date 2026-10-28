/**
 * Emplacements de stock, repris de Dolibarr (`llx_entrepot`, voir
 * `MIGRATION-DOLIBARR.md`) : magasin, atelier, grenier, parties et étagères.
 *
 * Ils ne forment pas un stock à part : `product_stock` répartit le stock des
 * produits de MSShop entre ces emplacements (reprise de `llx_product_stock`).
 */
import { and, asc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	brand,
	product,
	productStock,
	stockLocation,
	stockMovement,
	stockSerial,
	stockVoucher,
	type StockCondition,
	type StockMovementType
} from '$lib/server/db/catalog.schema';
import { inventoryCount } from '$lib/server/db/inventory.schema';
import type { ParseResult } from '$lib/server/forms';
import { syncProducts } from '$lib/server/meili';
import { thumbnailWithBrandFallbackSql } from '$lib/server/pricing';
import {
	conditionLabel,
	deletionBlockerOf,
	flattenLocations,
	isStockCondition,
	subtreeIds
} from '$lib/stock-locations';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class StockLocationError extends Error {}

/** Tous les emplacements dans l'ordre de l'arbre, avec ce qu'ils contiennent. */
export async function listStockLocations() {
	const rows = await db
		.select({
			id: stockLocation.id,
			name: stockLocation.name,
			code: stockLocation.code,
			parentId: stockLocation.parentId,
			position: stockLocation.position,
			isActive: stockLocation.isActive,
			description: stockLocation.description,
			priceOnLabel: stockLocation.priceOnLabel,
			legacyDoliId: stockLocation.legacyDoliId,
			// Colonnes qualifiées à la main : sur une seule table, drizzle les écrit
			// sans préfixe, et `id` désignerait alors la ligne de `product_stock`.
			products: sql<number>`(select count(distinct s.product_id)::int from ${productStock} s where s.location_id = ${stockLocation}.id and s.quantity <> 0)`,
			quantity: sql<number>`(select coalesce(sum(s.quantity), 0)::int from ${productStock} s where s.location_id = ${stockLocation}.id)`,
			/** Mouvements de stock passés par l'emplacement : son historique. */
			movements: sql<number>`(select count(*)::int from ${stockMovement} m where m.location_id = ${stockLocation}.id)`
		})
		.from(stockLocation)
		.orderBy(asc(stockLocation.position), asc(stockLocation.id));
	return flattenLocations(rows);
}

/**
 * Fiche produit telle que la montre un emplacement : photo, marque, stock
 * boutique et tous les emplacements où le produit est rangé, pour voir d'un
 * coup d'œil s'il est dispersé ou si le stock boutique ne correspond pas.
 */
const storedProductFields = {
	productId: product.id,
	name: product.name,
	reference: product.reference,
	ean13: product.ean13,
	isActive: product.isActive,
	brandName: brand.name,
	/** Photo du produit, à défaut le logo de sa marque (jointure `brand` requise). */
	imageUrl: thumbnailWithBrandFallbackSql,
	/** Stock de la boutique (`product.stock`), à comparer au rangement. */
	shopStock: product.stock,
	purchasePrice: product.purchasePrice,
	priceHt: product.priceHt,
	/** Toutes les quantités rangées de ce produit, par emplacement et par état. */
	placements: sql<{ locationId: number; condition: string; quantity: number }[]>`(
		select coalesce(json_agg(json_build_object(
			'locationId', s.location_id, 'condition', s.condition, 'quantity', s.quantity)
			order by s.quantity desc), '[]'::json)
		from ${productStock} s where s.product_id = ${product}.id and s.quantity <> 0)`
};

/** Numéros de série en stock d'une ligne (produit × emplacement × état). */
const lineSerialsSql = sql<string[]>`(
	select coalesce(array_agg(z.serial_number order by z.serial_number), '{}')
	from ${stockSerial} z
	where z.product_id = ${productStock}.product_id and z.location_id = ${productStock}.location_id
	  and z.condition = ${productStock}.condition)`;

/**
 * Lignes « produit rangé dans un emplacement », la forme commune du contenu
 * d'un emplacement et de la recherche : chaque ligne se coche et se déplace.
 */
function storedProductRows(where: SQL | undefined, limit?: number) {
	const query = db
		.select({
			...storedProductFields,
			locationId: productStock.locationId,
			condition: productStock.condition,
			quantity: productStock.quantity,
			serials: lineSerialsSql,
			updatedAt: productStock.updatedAt
		})
		.from(productStock)
		.innerJoin(product, eq(product.id, productStock.productId))
		.leftJoin(brand, eq(brand.id, product.brandId))
		.where(and(ne(productStock.quantity, 0), where))
		.orderBy(asc(product.name), asc(productStock.locationId), asc(productStock.condition));
	return limit ? query.limit(limit) : query;
}

/** Produits rangés dans ces emplacements, par nom. */
export async function listStoredProducts(locationIds: number[]) {
	if (!locationIds.length) return [];
	return storedProductRows(inArray(productStock.locationId, locationIds));
}

/**
 * « Où est rangé ce produit ? » : une ligne par emplacement des produits dont
 * le nom, la référence ou l'EAN contient chaque mot cherché (« carbu honda »
 * trouve « Carburateur | HONDA »).
 */
export async function searchStoredProducts(term: string, limit = 100) {
	const words = term.trim().split(/\s+/).filter(Boolean);
	const matches = words.map((word) => {
		const like = `%${word}%`;
		return or(
			ilike(product.name, like),
			ilike(product.reference, like),
			ilike(product.ean13, like)
		);
	});
	return storedProductRows(and(...matches), limit);
}

/** Emplacements d'un produit, pour sa fiche : le plus rempli d'abord. */
export async function listProductPlacements(productId: number) {
	const placed = await db
		.select({
			locationId: productStock.locationId,
			condition: productStock.condition,
			quantity: productStock.quantity,
			serials: lineSerialsSql
		})
		.from(productStock)
		.where(and(eq(productStock.productId, productId), ne(productStock.quantity, 0)))
		.orderBy(sql`${productStock.quantity} desc`);
	if (!placed.length) return [];
	const byId = new Map((await listStockLocations()).map((l) => [l.id, l]));
	return placed.map((p) => {
		const l = byId.get(p.locationId);
		return {
			...p,
			path: l?.path ?? '—',
			code: l?.code ?? null,
			description: l?.description ?? null
		};
	});
}

/**
 * Produits rangés dans un emplacement de vente (le MAGASIN ou l'un de ses
 * sous-emplacements) : leur étiquette porte le prix TTC.
 */
export async function productsOnSaleFloor(productIds: number[]): Promise<Set<number>> {
	if (!productIds.length) return new Set();
	const locations = await listStockLocations();
	const onSale = new Set(locations.filter((l) => l.priceOnLabel).map((l) => l.id));
	const saleFloor = locations
		.filter((l) => onSale.has(l.id) || l.ancestorIds.some((id) => onSale.has(id)))
		.map((l) => l.id);
	if (!saleFloor.length) return new Set();
	const rows = await db
		.selectDistinct({ productId: productStock.productId })
		.from(productStock)
		.where(
			and(
				inArray(productStock.productId, productIds),
				inArray(productStock.locationId, saleFloor),
				sql`${productStock.quantity} > 0`
			)
		);
	return new Set(rows.map((r) => r.productId));
}

/** Chiffres de la vue d'ensemble : ce qui est rangé, et les écarts avec la boutique. */
export async function getStockOverview() {
	const [row] = await db.execute<{
		products: number;
		units: number;
		value: string;
		mismatches: number;
	}>(sql`
		with stored as (
			select product_id, sum(quantity)::int as quantity
			from ${productStock} where quantity <> 0 group by product_id
		)
		select count(*)::int as products,
			coalesce(sum(s.quantity), 0)::int as units,
			coalesce(sum(s.quantity * coalesce(p.purchase_price, 0)), 0)::text as value,
			count(*) filter (where p.stock <> s.quantity)::int as mismatches
		from stored s join ${product} p on p.id = s.product_id`);
	return row;
}

// ----- Gestion des emplacements (Paramètres) -----

export type LocationInput = {
	name: string;
	code: string | null;
	/** Emplacement de vente : prix TTC sur l'étiquette des produits rangés dedans. */
	priceOnLabel: boolean;
	/** Affichée au survol du code (Dolibarr : `llx_entrepot.lieu`). */
	description: string | null;
	parentId: number | null;
	isActive: boolean;
};

/** Formulaire d'un emplacement : nom, code d'étiquette, parent (vide = racine), actif. */
export function parseLocationForm(form: FormData): ParseResult<LocationInput> {
	const name = (form.get('name')?.toString() ?? '').replace(/\s+/g, ' ').trim();
	if (!name) return { ok: false, error: "Indiquez le nom de l'emplacement." };
	const parentId = Number(form.get('parentId')) || null;
	return {
		ok: true,
		values: {
			name,
			code: form.get('code')?.toString().trim() || null,
			description: form.get('description')?.toString().replace(/\s+/g, ' ').trim() || null,
			parentId,
			isActive: form.get('isActive') !== 'false',
			priceOnLabel: form.get('priceOnLabel') === 'true'
		}
	};
}

/** Un code d'étiquette ne désigne qu'un emplacement (index `stock_location_code_idx`). */
async function assertCodeFree(code: string | null, exceptId: number | null) {
	if (!code) return;
	const [taken] = await db
		.select({ id: stockLocation.id, name: stockLocation.name })
		.from(stockLocation)
		.where(
			and(
				sql`upper(trim(${stockLocation.code})) = upper(${code})`,
				exceptId === null ? undefined : ne(stockLocation.id, exceptId)
			)
		)
		.limit(1);
	if (taken) {
		throw new StockLocationError(`Le code « ${code} » est déjà celui de « ${taken.name} ».`);
	}
}

/**
 * Refuse un parent introuvable, et un parent pris sous l'emplacement lui-même
 * (l'arbre deviendrait une boucle).
 */
async function assertParent(parentId: number | null, id: number | null) {
	if (parentId === null) return;
	const locations = await listStockLocations();
	if (!locations.some((l) => l.id === parentId)) {
		throw new StockLocationError('Emplacement parent introuvable.');
	}
	if (id !== null && subtreeIds(locations, id).includes(parentId)) {
		throw new StockLocationError(
			'Un emplacement ne peut pas être rangé sous lui-même ni sous ses sous-emplacements.'
		);
	}
}

/** Le code numérique sert d'ordre naturel, comme dans Dolibarr (« 41 » avant « 42 »). */
const positionOf = (code: string | null) => Number.parseInt(code ?? '', 10) || 0;

/** Ajoute un emplacement ; renvoie son identifiant. */
export async function createStockLocation(input: LocationInput) {
	await assertCodeFree(input.code, null);
	await assertParent(input.parentId, null);
	const [row] = await db
		.insert(stockLocation)
		.values({ ...input, position: positionOf(input.code) })
		.returning({ id: stockLocation.id });
	return row.id;
}

/** Renomme, recode, range ailleurs ou (dés)active un emplacement. */
export async function updateStockLocation(id: number, input: LocationInput) {
	await assertCodeFree(input.code, id);
	await assertParent(input.parentId, id);
	await db
		.update(stockLocation)
		.set({ ...input, position: positionOf(input.code), updatedAt: new Date() })
		.where(eq(stockLocation.id, id));
}

/** Ce qui empêche de supprimer un emplacement (voir `deletionBlockerOf`), ou null. */
export async function deletionBlocker(id: number): Promise<string | null> {
	const [row] = await db
		.select({
			legacyDoliId: stockLocation.legacyDoliId,
			children: sql<number>`(select count(*)::int from ${stockLocation} c where c.parent_id = ${stockLocation}.id)`,
			units: sql<number>`(select coalesce(sum(s.quantity), 0)::int from ${productStock} s where s.location_id = ${stockLocation}.id)`,
			// Historique : mouvements, comptages d'inventaire et numéros de série.
			movements: sql<number>`(
				(select count(*) from ${stockMovement} m where m.location_id = ${stockLocation}.id)
				+ (select count(*) from ${inventoryCount} c where c.location_id = ${stockLocation}.id)
				+ (select count(*) from ${stockSerial} z where z.location_id = ${stockLocation}.id))::int`
		})
		.from(stockLocation)
		.where(eq(stockLocation.id, id));
	return row ? deletionBlockerOf(row) : 'Emplacement introuvable.';
}

/** Supprime un emplacement vide, sans historique ni sous-emplacement. */
export async function deleteStockLocation(id: number) {
	const blocker = await deletionBlocker(id);
	if (blocker) throw new StockLocationError(`Suppression impossible. ${blocker}`);
	await db.transaction(async (tx) => {
		// Les lignes à 0 ne sont que des traces de reprise.
		await tx.delete(productStock).where(eq(productStock.locationId, id));
		await tx.delete(stockLocation).where(eq(stockLocation.id, id));
	});
}

// ----- Déplacement de produits -----

export type TransferLine = {
	productId: number;
	fromId: number;
	condition: StockCondition;
	quantity: number;
	/** Numéros de série des unités déplacées (le reste part sans numéro). */
	serials: string[];
};
export type TransferInput = { toId: number; reference: string | null; lines: TransferLine[] };

/**
 * Formulaire de déplacement : une destination, une pièce facultative (n° de
 * bon) et des lignes `productId` / `fromId` / `condition` / `quantity` répétées
 * dans l'ordre. Les numéros de série cochés arrivent en `serials` sous la forme
 * « rang de la ligne:numéro ».
 */
export function parseTransferForm(form: FormData): ParseResult<TransferInput> {
	const toId = Number(form.get('toId'));
	if (!Number.isInteger(toId) || toId <= 0) {
		return { ok: false, error: "Choisissez l'emplacement de destination." };
	}
	const products = form.getAll('productId').map(Number);
	const froms = form.getAll('fromId').map(Number);
	const conditions = form.getAll('condition').map(String);
	const quantities = form.getAll('quantity').map(Number);
	if (!products.length) return { ok: false, error: 'Aucun produit à déplacer.' };
	const serialsOf = (i: number) =>
		form
			.getAll('serials')
			.map(String)
			.filter((v) => v.startsWith(`${i}:`))
			.map((v) => v.slice(String(i).length + 1));

	const lines: TransferLine[] = [];
	const seen = new Set<string>();
	for (const [i, productId] of products.entries()) {
		const condition = conditions[i] ?? 'new';
		if (!isStockCondition(condition)) return { ok: false, error: 'État du stock inconnu.' };
		const line: TransferLine = {
			productId,
			fromId: froms[i],
			condition,
			quantity: quantities[i],
			serials: serialsOf(i)
		};
		if (![line.productId, line.fromId, line.quantity].every((n) => Number.isInteger(n) && n > 0)) {
			return { ok: false, error: 'Chaque quantité doit être un nombre entier positif.' };
		}
		if (line.serials.length > line.quantity) {
			return { ok: false, error: 'Plus de numéros de série cochés que de pièces déplacées.' };
		}
		if (line.fromId === toId) {
			return { ok: false, error: "Un produit est déjà dans l'emplacement de destination." };
		}
		const key = `${line.productId}:${line.fromId}:${line.condition}`;
		if (seen.has(key)) return { ok: false, error: 'Un produit figure deux fois.' };
		seen.add(key);
		lines.push(line);
	}
	const reference = form.get('reference')?.toString().trim() || null;
	return { ok: true, values: { toId, reference, lines } };
}

/**
 * Déplace des produits d'un emplacement à un autre, tout ou rien. Chaque ligne
 * laisse ses mouvements `transfer` (sortie de l'origine, entrée à la
 * destination, un par numéro de série), comme les déplacements du module
 * Dolibarr « UTILE » ; le stock total du produit ne change donc pas.
 */
export async function transferStock(input: TransferInput, createdBy: string | null) {
	await db.transaction(async (tx) => {
		const [target] = await tx
			.select({ isActive: stockLocation.isActive })
			.from(stockLocation)
			.where(eq(stockLocation.id, input.toId));
		if (!target) throw new StockLocationError('Emplacement de destination introuvable.');
		if (!target.isActive) {
			throw new StockLocationError("L'emplacement de destination est désactivé.");
		}
		for (const line of input.lines) {
			const common = {
				productId: line.productId,
				condition: line.condition,
				type: 'transfer' as const,
				reference: input.reference,
				createdBy
			};
			for (const part of splitBySerial(line.quantity, line.serials)) {
				await applyMovement(tx, {
					...common,
					...part,
					locationId: line.fromId,
					quantity: -part.quantity
				});
				await applyMovement(tx, { ...common, ...part, locationId: input.toId });
			}
		}
	});
}

/** Une unité par numéro de série, puis le reste sans numéro. */
function splitBySerial(quantity: number, serials: string[]) {
	const parts: { quantity: number; serialNumber: string | null }[] = serials.map((s) => ({
		quantity: 1,
		serialNumber: s
	}));
	if (quantity > serials.length)
		parts.push({ quantity: quantity - serials.length, serialNumber: null });
	return parts;
}

// ----- Mouvements de stock -----

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MovementInput = {
	productId: number;
	locationId: number;
	/** État du stock touché : neuf (par défaut), occasion, garantie. */
	condition?: StockCondition;
	/** Positif = entrée dans l'emplacement, négatif = sortie. */
	quantity: number;
	type: StockMovementType;
	/** Numéro de série de l'unité (le mouvement porte alors sur 1 pièce). */
	serialNumber?: string | null;
	/** Pièce : n° de commande, d'ordre de réparation, de BL, de bon… */
	reference?: string | null;
	note?: string | null;
	createdBy?: string | null;
	/** Bon d'entrée ou de sortie qui regroupe le mouvement. */
	voucherId?: number | null;
};

/** Libellés lisibles d'un produit et d'un emplacement, pour les messages. */
async function names(tx: Tx, productId: number, locationId: number) {
	const [row] = await tx
		.select({ product: product.name, code: stockLocation.code, name: stockLocation.name })
		.from(product)
		.innerJoin(stockLocation, eq(stockLocation.id, locationId))
		.where(eq(product.id, productId));
	return {
		product: row?.product ?? 'Produit introuvable',
		at: row?.code ?? row?.name ?? "l'emplacement"
	};
}

/**
 * Le seul chemin qui modifie le stock : la ligne d'emplacement et d'état
 * (`product_stock`), le stock du produit (`product.stock`) et, le cas échéant,
 * le numéro de série (`stock_serial`) bougent ensemble, et le mouvement est
 * tracé. `product.stock` reste ainsi la somme de ses emplacements, comme dans
 * Dolibarr, qui fait foi.
 *
 * Règle des numéros de série : une ligne ne compte jamais plus de numéros en
 * stock que de pièces. Sortir une pièce d'une ligne dont toutes les pièces sont
 * numérotées demande donc de dire laquelle.
 */
async function applyMovement(tx: Tx, m: MovementInput) {
	const condition = m.condition ?? 'new';
	const serial = m.serialNumber?.trim() || null;
	if (serial && Math.abs(m.quantity) !== 1) {
		throw new StockLocationError('Un numéro de série désigne une seule pièce.');
	}
	const line = and(
		eq(productStock.productId, m.productId),
		eq(productStock.locationId, m.locationId),
		eq(productStock.condition, condition)
	);
	if (m.quantity < 0) {
		const [row] = await tx
			.select({ quantity: productStock.quantity })
			.from(productStock)
			.where(line)
			.for('update');
		if ((row?.quantity ?? 0) < -m.quantity) {
			const n = await names(tx, m.productId, m.locationId);
			throw new StockLocationError(
				`${n.product} : il n'en reste que ${row?.quantity ?? 0} (${conditionLabel(condition).toLowerCase()}) en ${n.at}.`
			);
		}
	}

	if (serial) {
		const sameSerial = and(
			eq(stockSerial.productId, m.productId),
			sql`upper(${stockSerial.serialNumber}) = upper(${serial})`
		);
		if (m.quantity < 0) {
			const moved = await tx
				.update(stockSerial)
				.set({ locationId: null, updatedAt: new Date() })
				.where(
					and(
						sameSerial,
						eq(stockSerial.locationId, m.locationId),
						eq(stockSerial.condition, condition)
					)
				)
				.returning({ id: stockSerial.id });
			if (!moved.length) {
				const n = await names(tx, m.productId, m.locationId);
				throw new StockLocationError(
					`${n.product} : le n° ${serial} n'est pas en stock en ${n.at}.`
				);
			}
		} else {
			const [known] = await tx
				.select({ locationId: stockSerial.locationId })
				.from(stockSerial)
				.where(sameSerial);
			if (known?.locationId) {
				throw new StockLocationError(`Le n° de série ${serial} est déjà en stock.`);
			}
			// Index unique sur une expression (`upper`) : conflit écrit à la main.
			await tx.execute(sql`
				INSERT INTO ${stockSerial} (product_id, serial_number, location_id, condition)
				VALUES (${m.productId}, ${serial}, ${m.locationId}, ${condition})
				ON CONFLICT (product_id, upper(serial_number))
				DO UPDATE SET location_id = excluded.location_id, condition = excluded.condition,
					updated_at = now()`);
		}
	}

	const now = new Date();
	const [after] = await tx
		.insert(productStock)
		.values({
			productId: m.productId,
			locationId: m.locationId,
			condition,
			quantity: m.quantity,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [productStock.productId, productStock.locationId, productStock.condition],
			set: { quantity: sql`${productStock.quantity} + ${m.quantity}`, updatedAt: now }
		})
		.returning({ quantity: productStock.quantity });
	const [{ serials }] = await tx
		.select({ serials: sql<number>`count(*)::int` })
		.from(stockSerial)
		.where(
			and(
				eq(stockSerial.productId, m.productId),
				eq(stockSerial.locationId, m.locationId),
				eq(stockSerial.condition, condition)
			)
		);
	if (serials > after.quantity) {
		const n = await names(tx, m.productId, m.locationId);
		throw new StockLocationError(
			`${n.product} : toutes les pièces en ${n.at} sont numérotées, indiquez le n° de série de celle qui sort.`
		);
	}
	await tx
		.update(product)
		.set({ stock: sql`${product.stock} + ${m.quantity}`, updatedAt: now })
		.where(eq(product.id, m.productId));
	await tx.insert(stockMovement).values({
		productId: m.productId,
		locationId: m.locationId,
		condition,
		quantity: m.quantity,
		type: m.type,
		serialNumber: serial,
		reference: m.reference ?? null,
		note: m.note ?? null,
		createdBy: m.createdBy ?? null,
		voucherId: m.voucherId ?? null
	});
}

/** Enregistre un mouvement de stock (entrée, sortie, ajustement) sur un emplacement. */
export async function recordStockMovement(m: MovementInput) {
	if (!Number.isInteger(m.quantity) || m.quantity === 0) {
		throw new StockLocationError('La quantité doit être un nombre entier non nul.');
	}
	await db.transaction((tx) => applyMovement(tx, m));
	// « En stock » est un filtre et un critère de classement de la recherche.
	syncProducts([m.productId]);
}

/** Un bon et ses mouvements, enregistrés ensemble. */
export type VoucherInput = {
	voucher: {
		kind: 'receipt' | 'issue';
		reference: string | null;
		supplier?: string | null;
		reason?: string | null;
		note?: string | null;
		createdBy: string | null;
	};
	movements: Omit<MovementInput, 'voucherId'>[];
};

/**
 * Enregistre des bons (réception, sortie) et leurs mouvements dans une seule
 * transaction : tout passe, ou rien. Renvoie les identifiants des bons.
 */
export async function recordVouchers(vouchers: VoucherInput[]): Promise<number[]> {
	const ids = await db.transaction(async (tx) => {
		const created: number[] = [];
		for (const v of vouchers) {
			const [row] = await tx
				.insert(stockVoucher)
				.values(v.voucher)
				.returning({ id: stockVoucher.id });
			for (const m of v.movements) await applyMovement(tx, { ...m, voucherId: row.id });
			created.push(row.id);
		}
		return created;
	});
	syncProducts([...new Set(vouchers.flatMap((v) => v.movements.map((m) => m.productId)))]);
	return ids;
}

/**
 * Annule un bon : chaque mouvement est contrepassé (même emplacement, état et
 * numéro de série), puis le bon est marqué annulé. Refusé si le stock a déjà
 * bougé depuis (la pièce reçue est sortie), et pour l'historique Dolibarr,
 * qui n'a pas d'emplacement.
 */
export async function cancelVoucher(id: number, createdBy: string | null) {
	const movements = await db.select().from(stockMovement).where(eq(stockMovement.voucherId, id));
	const [voucher] = await db.select().from(stockVoucher).where(eq(stockVoucher.id, id));
	if (!voucher) throw new StockLocationError('Bon introuvable.');
	if (voucher.cancelledAt) throw new StockLocationError('Ce bon est déjà annulé.');
	if (voucher.legacyDoliKey || movements.some((m) => m.locationId === null)) {
		throw new StockLocationError(
			"Un bon repris de Dolibarr ne s'annule pas : il n'a pas d'emplacement."
		);
	}
	await db.transaction(async (tx) => {
		for (const m of movements) {
			await applyMovement(tx, {
				productId: m.productId,
				locationId: m.locationId!,
				condition: m.condition as StockCondition,
				quantity: -m.quantity,
				type: m.type as StockMovementType,
				serialNumber: m.serialNumber,
				reference: m.reference,
				note: `Annulation du bon n° ${id}`,
				createdBy,
				voucherId: id
			});
		}
		await tx.update(stockVoucher).set({ cancelledAt: new Date() }).where(eq(stockVoucher.id, id));
	});
	syncProducts([...new Set(movements.map((m) => m.productId))]);
}

/**
 * Applique des mouvements dans une seule transaction (validation
 * d'inventaire) : tout passe, ou rien.
 */
export async function recordStockMovements(
	movements: MovementInput[],
	before?: (tx: Tx) => Promise<void>,
	after?: (tx: Tx) => Promise<void>
) {
	await db.transaction(async (tx) => {
		await before?.(tx);
		for (const m of movements) await applyMovement(tx, m);
		await after?.(tx);
	});
	syncProducts([...new Set(movements.map((m) => m.productId))]);
}

// ----- Sortie de stock d'une commande ou d'un ordre de réparation -----

/** Nature de la sortie : vente (commande) ou pièce posée (ordre de réparation). */
export type DocumentStockType = 'order' | 'repair';

/** Une ligne de document : le produit et la quantité à sortir. */
export type DocumentLine = { productId: number; quantity: number };

/**
 * Où est rangé chaque produit d'une commande ou d'un ordre, et combien en est
 * déjà sorti pour ce document. Rien n'est automatique : le magasinier sort
 * lui-même les pièces, comme dans Dolibarr (bons de sortie du module UTILE).
 */
export async function getDocumentStock(
	lines: DocumentLine[],
	type: DocumentStockType,
	reference: string
) {
	const productIds = [...new Set(lines.map((l) => l.productId))];
	if (!productIds.length) return {};
	const [placed, exits, locations] = await Promise.all([
		db
			.select({
				productId: productStock.productId,
				locationId: productStock.locationId,
				condition: productStock.condition,
				quantity: productStock.quantity,
				serials: lineSerialsSql
			})
			.from(productStock)
			.where(and(inArray(productStock.productId, productIds), ne(productStock.quantity, 0)))
			.orderBy(sql`${productStock.quantity} desc`),
		db
			.select({
				productId: stockMovement.productId,
				exited: sql<number>`(-sum(${stockMovement.quantity}))::int`
			})
			.from(stockMovement)
			.where(
				and(
					inArray(stockMovement.productId, productIds),
					eq(stockMovement.type, type),
					eq(stockMovement.reference, reference)
				)
			)
			.groupBy(stockMovement.productId),
		listStockLocations()
	]);
	const byId = new Map(locations.map((l) => [l.id, l]));
	const stock: Record<number, DocumentProductStock> = {};
	for (const id of productIds) {
		stock[id] = {
			needed: lines.filter((l) => l.productId === id).reduce((sum, l) => sum + l.quantity, 0),
			exited: exits.find((e) => e.productId === id)?.exited ?? 0,
			placements: placed
				.filter((p) => p.productId === id)
				.map((p) => {
					const l = byId.get(p.locationId);
					return {
						locationId: p.locationId,
						condition: p.condition,
						quantity: p.quantity,
						serials: p.serials,
						code: l?.code ?? null,
						path: l?.path ?? '—',
						description: l?.description ?? null
					};
				})
		};
	}
	return stock;
}

export type DocumentProductStock = {
	/** Quantité à sortir pour ce document (toutes ses lignes du produit). */
	needed: number;
	/** Déjà sortie pour ce document. */
	exited: number;
	placements: {
		locationId: number;
		condition: string;
		quantity: number;
		serials: string[];
		code: string | null;
		path: string;
		description: string | null;
	}[];
};

/**
 * Sort du stock un produit d'une commande ou d'un ordre, depuis l'emplacement
 * choisi par le magasinier. Refuse de sortir plus que le document ne demande.
 */
export async function exitDocumentStock(input: {
	lines: DocumentLine[];
	type: DocumentStockType;
	reference: string;
	productId: number;
	locationId: number;
	condition: StockCondition;
	quantity: number;
	/** Numéros de série des pièces sorties. */
	serials: string[];
	createdBy: string | null;
}) {
	if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
		throw new StockLocationError('La quantité à sortir doit être un nombre entier positif.');
	}
	const stock = (await getDocumentStock(input.lines, input.type, input.reference))[input.productId];
	if (!stock) throw new StockLocationError('Ce produit ne figure pas dans le document.');
	const remaining = stock.needed - stock.exited;
	if (input.quantity > remaining) {
		throw new StockLocationError(
			remaining > 0
				? `Il ne reste que ${remaining} à sortir pour ce document.`
				: 'Ce produit est déjà entièrement sorti du stock pour ce document.'
		);
	}
	if (input.serials.length > input.quantity) {
		throw new StockLocationError('Plus de numéros de série cochés que de pièces sorties.');
	}
	await recordStockMovements(
		splitBySerial(input.quantity, input.serials).map((part) => ({
			productId: input.productId,
			locationId: input.locationId,
			condition: input.condition,
			quantity: -part.quantity,
			serialNumber: part.serialNumber,
			type: input.type,
			reference: input.reference,
			createdBy: input.createdBy
		}))
	);
}

/** Lit le formulaire de sortie d'une ligne de document (emplacement, état, quantité, n°). */
export function parseDocumentExit(form: FormData) {
	const condition = String(form.get('condition') ?? 'new');
	return {
		productId: Number(form.get('productId')),
		locationId: Number(form.get('locationId')),
		condition: isStockCondition(condition) ? condition : ('new' as const),
		quantity: Number(form.get('quantity')),
		serials: form.getAll('serials').map(String).filter(Boolean)
	};
}

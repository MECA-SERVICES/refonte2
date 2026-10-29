/**
 * Bons de stock, repris des écrans « Entrer les stocks » et « Sortir les
 * stocks » du module Dolibarr « UTILE » :
 *
 * - **réception** (bon d'entrée) : n° de BL et fournisseur ; chaque ligne
 *   entre dans un emplacement, avec son état et ses numéros de série. Une
 *   partie peut repartir aussitôt (pièce commandée pour un client) : UTILE la
 *   sortait par un bon « Sortie-auto du BL » ;
 * - **sortie** (bon de sortie) : motif normal, consommable ou investissement,
 *   depuis l'emplacement choisi.
 *
 * Les mouvements passent par `recordVouchers` : stock, numéros de série et
 * historique bougent ensemble.
 */
import { and, desc, eq, gte, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	brand,
	product,
	stockMovement,
	stockVoucher,
	supplier,
	type StockCondition,
	type StockIssueReason
} from '$lib/server/db/catalog.schema';
import type { ParseResult } from '$lib/server/forms';
import { thumbnailWithBrandFallbackSql } from '$lib/server/pricing';
import { recordVouchers, type MovementInput } from '$lib/server/stock-locations';
import { isStockCondition } from '$lib/stock-locations';

export type VoucherKind = 'receipt' | 'issue';

/** Motifs de sortie, dans l'ordre d'UTILE. */
export const ISSUE_REASONS: { value: StockIssueReason; name: string }[] = [
	{ value: 'normal', name: 'Normal' },
	{ value: 'consumable', name: 'Consommable' },
	{ value: 'investment', name: 'Investissement' }
];

/**
 * Bons d'un type, du plus récent au plus ancien. Sans recherche : les 30
 * derniers jours, comme UTILE. La recherche porte sur le n° de bon, le
 * fournisseur et la référence des produits.
 */
export async function listVouchers(kind: VoucherKind, term: string) {
	const q = term.trim();
	const like = `%${q}%`;
	const where: SQL[] = [eq(stockVoucher.kind, kind)];
	if (q) {
		where.push(
			or(
				ilike(stockVoucher.reference, like),
				ilike(stockVoucher.supplier, like),
				sql`exists (select 1 from ${stockMovement} m join ${product} p on p.id = m.product_id
					where m.voucher_id = ${stockVoucher}.id and p.reference ilike ${like})`
			)!
		);
	} else {
		where.push(gte(stockVoucher.createdAt, sql`now() - interval '30 days'`));
	}
	return db
		.select({
			id: stockVoucher.id,
			createdAt: stockVoucher.createdAt,
			reference: stockVoucher.reference,
			supplier: stockVoucher.supplier,
			reason: stockVoucher.reason,
			cancelledAt: stockVoucher.cancelledAt,
			legacyDoliKey: stockVoucher.legacyDoliKey,
			lines: sql<number>`(select count(*)::int from ${stockMovement} m where m.voucher_id = ${stockVoucher}.id and m.note is null)`,
			units: sql<number>`(select coalesce(sum(abs(m.quantity)), 0)::int from ${stockMovement} m where m.voucher_id = ${stockVoucher}.id and m.note is null)`
		})
		.from(stockVoucher)
		.where(and(...where))
		.orderBy(desc(stockVoucher.createdAt))
		.limit(200);
}

/** Un bon et ses lignes (photo, emplacement, état, numéro de série). */
export async function getVoucher(id: number) {
	const [voucher] = await db.select().from(stockVoucher).where(eq(stockVoucher.id, id));
	if (!voucher) return null;
	const lines = await db
		.select({
			id: stockMovement.id,
			productId: stockMovement.productId,
			name: product.name,
			reference: product.reference,
			ean13: product.ean13,
			imageUrl: thumbnailWithBrandFallbackSql,
			locationId: stockMovement.locationId,
			condition: stockMovement.condition,
			quantity: stockMovement.quantity,
			serialNumber: stockMovement.serialNumber,
			note: stockMovement.note,
			createdAt: stockMovement.createdAt
		})
		.from(stockMovement)
		.innerJoin(product, eq(product.id, stockMovement.productId))
		.leftJoin(brand, eq(brand.id, product.brandId))
		.where(eq(stockMovement.voucherId, id))
		.orderBy(stockMovement.id);
	return { voucher, lines };
}

export type VoucherLine = {
	productId: number;
	locationId: number;
	condition: StockCondition;
	quantity: number;
	/** Réception : pièces qui repartent aussitôt (commandées pour un client). */
	immediate: number;
	serials: string[];
};

export type VoucherForm = {
	reference: string | null;
	/** Fournisseur du BL (réception), parmi les fournisseurs actifs. */
	supplierId: number | null;
	reason: StockIssueReason;
	note: string | null;
	lines: VoucherLine[];
};

/**
 * Formulaire d'un bon : en-tête (n° de BL ou de bon, fournisseur, motif, note)
 * et lignes `productId` / `locationId` / `condition` / `quantity` /
 * `immediate` répétées dans l'ordre. Les numéros de série arrivent en
 * `serials` sous la forme « rang de la ligne:numéro ».
 */
export function parseVoucherForm(form: FormData, kind: VoucherKind): ParseResult<VoucherForm> {
	const all = (name: string) => form.getAll(name).map(String);
	const products = all('productId').map(Number);
	if (!products.length) return { ok: false, error: 'Ajoutez au moins un produit.' };
	const locations = all('locationId').map(Number);
	const conditions = all('condition');
	const quantities = all('quantity').map(Number);
	const immediates = all('immediate').map((v) => Number(v || 0));
	const serials = all('serials');

	const lines: VoucherLine[] = [];
	for (const [i, productId] of products.entries()) {
		const condition = conditions[i] ?? 'new';
		const line: VoucherLine = {
			productId,
			locationId: locations[i],
			condition: isStockCondition(condition) ? condition : 'new',
			quantity: quantities[i],
			immediate: kind === 'receipt' ? immediates[i] || 0 : 0,
			serials: serials
				.filter((v) => v.startsWith(`${i}:`))
				.map((v) => v.slice(String(i).length + 1).trim())
				.filter(Boolean)
		};
		if (!Number.isInteger(line.locationId) || line.locationId <= 0) {
			return { ok: false, error: `Ligne ${i + 1} : choisissez l'emplacement.` };
		}
		if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
			return {
				ok: false,
				error: `Ligne ${i + 1} : la quantité doit être un nombre entier positif.`
			};
		}
		if (!Number.isInteger(line.immediate) || line.immediate < 0 || line.immediate > line.quantity) {
			return { ok: false, error: `Ligne ${i + 1} : on ne peut pas faire repartir plus que reçu.` };
		}
		if (line.serials.length > line.quantity) {
			return { ok: false, error: `Ligne ${i + 1} : plus de numéros de série que de pièces.` };
		}
		if (new Set(line.serials.map((s) => s.toUpperCase())).size < line.serials.length) {
			return { ok: false, error: `Ligne ${i + 1} : un numéro de série figure deux fois.` };
		}
		lines.push(line);
	}
	const reason = String(form.get('reason') ?? 'normal');
	return {
		ok: true,
		values: {
			reference: form.get('reference')?.toString().trim() || null,
			supplierId: Number(form.get('supplierId')) || null,
			reason: ISSUE_REASONS.some((r) => r.value === reason)
				? (reason as StockIssueReason)
				: 'normal',
			note: form.get('note')?.toString().trim() || null,
			lines
		}
	};
}

/** Une pièce par numéro de série, puis le reste sans numéro. */
function bySerial(line: VoucherLine, quantity: number, serials: string[]) {
	const parts: { quantity: number; serialNumber: string | null }[] = serials.map(
		(serialNumber) => ({
			quantity: 1,
			serialNumber
		})
	);
	if (quantity > serials.length)
		parts.push({ quantity: quantity - serials.length, serialNumber: null });
	return parts.map((p) => ({
		productId: line.productId,
		locationId: line.locationId,
		condition: line.condition,
		quantity: p.quantity,
		serialNumber: p.serialNumber
	}));
}

/**
 * Enregistre une réception. Les pièces qui repartent aussitôt sortent par un
 * second bon, « Sortie-auto du BL », comme dans UTILE ; les premières pièces
 * numérotées sont celles qui repartent. Renvoie l'identifiant du bon d'entrée.
 */
export async function createReceipt(form: VoucherForm, createdBy: string | null) {
	const [found] = form.supplierId
		? await db
				.select({ name: supplier.name })
				.from(supplier)
				.where(eq(supplier.id, form.supplierId))
		: [];
	const entries: Omit<MovementInput, 'voucherId'>[] = form.lines.flatMap((l) =>
		bySerial(l, l.quantity, l.serials).map((m) => ({
			...m,
			type: 'in' as const,
			reference: form.reference,
			createdBy
		}))
	);
	const exits = form.lines
		.filter((l) => l.immediate > 0)
		.flatMap((l) =>
			bySerial(l, l.immediate, l.serials.slice(0, l.immediate)).map((m) => ({
				...m,
				quantity: -m.quantity,
				type: 'out' as const,
				reference: form.reference,
				createdBy
			}))
		);
	const [receiptId] = await recordVouchers([
		{
			voucher: {
				kind: 'receipt',
				reference: form.reference,
				supplier: found?.name ?? null,
				supplierId: found ? form.supplierId : null,
				note: form.note,
				createdBy
			},
			movements: entries
		},
		...(exits.length
			? [
					{
						voucher: {
							kind: 'issue' as const,
							reference: form.reference ? `Sortie-auto du BL : ${form.reference}` : 'Sortie-auto',
							reason: 'normal',
							createdBy
						},
						movements: exits
					}
				]
			: [])
	]);
	return receiptId;
}

/** Enregistre une sortie libre (motif normal, consommable, investissement). */
export async function createIssue(form: VoucherForm, createdBy: string | null) {
	const [id] = await recordVouchers([
		{
			voucher: {
				kind: 'issue',
				reference: form.reference,
				reason: form.reason,
				note: form.note,
				createdBy
			},
			movements: form.lines.flatMap((l) =>
				bySerial(l, l.quantity, l.serials).map((m) => ({
					...m,
					quantity: -m.quantity,
					type: 'out' as const,
					reference: form.reference,
					createdBy
				}))
			)
		}
	]);
	return id;
}

/** Produits d'un bon pour les étiquettes : un exemplaire par pièce entrée. */
export async function labelIdsOf(voucherId: number) {
	const rows = await db
		.select({ productId: stockMovement.productId, quantity: stockMovement.quantity })
		.from(stockMovement)
		.where(and(eq(stockMovement.voucherId, voucherId), sql`${stockMovement.quantity} > 0`))
		.orderBy(stockMovement.id);
	return rows.flatMap((r) => Array.from({ length: r.quantity }, () => r.productId)).slice(0, 500);
}

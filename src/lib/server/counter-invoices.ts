/**
 * Factures comptoir et avoirs (remplacement de la facturation Dolibarr, voir
 * `MIGRATION-DOLIBARR.md`), sur les clients, produits, prestations, règlements
 * et stock de MSShop.
 *
 * Cycle d'une facture :
 * 1. **brouillon** : client, lignes (produit, prestation ou ligne libre),
 *    remises — tout se modifie ;
 * 2. **validation** : numéro légal dans la série Dolibarr (`FA2611-1316`),
 *    totaux, TVA et adresse figés ; plus rien ne bouge ;
 * 3. **règlements** (chèque, espèces, carte, virement) jusqu'à « payée » ;
 * 4. correction éventuelle par un **avoir** (`AV2611-0033`), ou classement
 *    « abandonnée » pour un reste dû qui ne sera pas encaissé.
 */
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { address, customer } from '$lib/server/db/customer.schema';
import { product, taxRule } from '$lib/server/db/catalog.schema';
import { repairOrder, repairOrderPart } from '$lib/server/db/repair.schema';
import { settlement } from '$lib/server/db/settlement.schema';
import {
	counterInvoice,
	counterInvoiceLine,
	customerCredit,
	type CounterBillingAddress,
	type CounterInvoiceStatus
} from '$lib/server/db/counter-invoice.schema';
import { buildSettlementReference, type SettlementMethod } from '$lib/settlements';
import type { SettlementInput } from '$lib/server/settlements';
import { formatPrice, round2 } from '$lib/money';
import {
	dueDate,
	formatCounterNumber,
	invoiceTotals,
	lineDetail,
	lineTotals,
	priceHtFromTtc,
	remainingDue,
	type PaymentTerms
} from '$lib/counter-invoices';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class CounterInvoiceError extends Error {}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Règlements d'une facture : les siens, et ceux de l'ordre de réparation facturé. */
function settlementsOf(invoiceId: SQL | number, repairOrderId: SQL | number | null) {
	return or(
		eq(settlement.counterInvoiceId, invoiceId as number),
		repairOrderId === null
			? sql`false`
			: and(
					eq(settlement.repairOrderId, repairOrderId as number),
					isNull(settlement.counterInvoiceId)
				)
	);
}

const paidSql = sql<string>`(select coalesce(sum(s.amount), 0)::text from ${settlement} s
	where s.counter_invoice_id = ${counterInvoice}.id
	   or (${counterInvoice}.repair_order_id is not null and s.repair_order_id = ${counterInvoice}.repair_order_id
	       and s.counter_invoice_id is null))`;
/** Avoirs validés qui corrigent la facture (montants négatifs). */
const creditedSql = sql<string>`(select coalesce(-sum(a.total_ttc), 0)::text from ${counterInvoice} a
	where a.credited_invoice_id = ${counterInvoice}.id and a.status <> 'draft')`;

// ===========================================================================
// Lecture
// ===========================================================================

export type CounterListFilter = 'all' | 'draft' | 'unpaid' | 'paid' | 'credit_note';

/** Factures et avoirs, du plus récent au plus ancien, avec ce qui reste dû. */
export async function listCounterInvoices(filter: CounterListFilter, term: string, limit = 200) {
	const where: SQL[] = [];
	if (filter === 'draft') where.push(eq(counterInvoice.status, 'draft'));
	if (filter === 'unpaid') {
		where.push(eq(counterInvoice.kind, 'invoice'), eq(counterInvoice.status, 'validated'));
	}
	if (filter === 'paid')
		where.push(eq(counterInvoice.status, 'paid'), eq(counterInvoice.kind, 'invoice'));
	if (filter === 'credit_note') where.push(eq(counterInvoice.kind, 'credit_note'));
	const q = term.trim();
	if (q) {
		const like = `%${q}%`;
		where.push(
			or(
				ilike(counterInvoice.number, like),
				ilike(customer.lastName, like),
				ilike(customer.firstName, like),
				ilike(customer.companyName, like),
				ilike(customer.email, like)
			)!
		);
	}
	return db
		.select({
			id: counterInvoice.id,
			kind: counterInvoice.kind,
			number: counterInvoice.number,
			status: counterInvoice.status,
			issuedOn: counterInvoice.issuedOn,
			createdAt: counterInvoice.createdAt,
			totalTtc: counterInvoice.totalTtc,
			paid: paidSql,
			credited: creditedSql,
			customerId: customer.id,
			customerName: sql<string>`coalesce(nullif(${customer.companyName}, ''), trim(concat(${customer.firstName}, ' ', ${customer.lastName})))`,
			repairOrderId: counterInvoice.repairOrderId,
			legacyDoliId: counterInvoice.legacyDoliId
		})
		.from(counterInvoice)
		.innerJoin(customer, eq(customer.id, counterInvoice.customerId))
		.where(where.length ? and(...where) : undefined)
		.orderBy(
			desc(sql`coalesce(${counterInvoice.issuedOn}, ${counterInvoice.createdAt}::date)`),
			desc(counterInvoice.id)
		)
		.limit(limit);
}

/** Impayés : nombre et montant restant dû des factures validées. */
export async function unpaidSummary() {
	const [row] = await db
		.select({
			count: sql<number>`count(*)::int`,
			due: sql<string>`coalesce(sum(${counterInvoice.totalTtc} - ${paidSql}::numeric - ${creditedSql}::numeric), 0)::text`
		})
		.from(counterInvoice)
		.where(and(eq(counterInvoice.kind, 'invoice'), eq(counterInvoice.status, 'validated')));
	return row;
}

/** Une facture, son client, ses lignes, ses règlements, ses avoirs et ce qui reste dû. */
export async function getCounterInvoice(id: number) {
	const [invoice] = await db.select().from(counterInvoice).where(eq(counterInvoice.id, id));
	if (!invoice) return null;
	const [client] = await db.select().from(customer).where(eq(customer.id, invoice.customerId));
	const [lines, settlements, creditNotes, credited, repair] = await Promise.all([
		db
			.select({
				line: counterInvoiceLine,
				productType: product.type,
				productActive: product.isActive
			})
			.from(counterInvoiceLine)
			.leftJoin(product, eq(product.id, counterInvoiceLine.productId))
			.where(eq(counterInvoiceLine.invoiceId, id))
			.orderBy(asc(counterInvoiceLine.position), asc(counterInvoiceLine.id)),
		db
			.select()
			.from(settlement)
			.where(settlementsOf(id, invoice.repairOrderId))
			.orderBy(asc(settlement.receivedOn), asc(settlement.id)),
		db
			.select({
				id: counterInvoice.id,
				number: counterInvoice.number,
				status: counterInvoice.status,
				totalTtc: counterInvoice.totalTtc,
				issuedOn: counterInvoice.issuedOn
			})
			.from(counterInvoice)
			.where(eq(counterInvoice.creditedInvoiceId, id))
			.orderBy(asc(counterInvoice.id)),
		invoice.creditedInvoiceId
			? db
					.select({ id: counterInvoice.id, number: counterInvoice.number })
					.from(counterInvoice)
					.where(eq(counterInvoice.id, invoice.creditedInvoiceId))
			: [],
		invoice.repairOrderId
			? db
					.select({ id: repairOrder.id, reference: repairOrder.reference })
					.from(repairOrder)
					.where(eq(repairOrder.id, invoice.repairOrderId))
			: []
	]);
	const paid = round2(settlements.reduce((s, p) => s + Number(p.amount), 0));
	const creditedTotal = round2(
		creditNotes.filter((c) => c.status !== 'draft').reduce((s, c) => s - Number(c.totalTtc), 0)
	);
	return {
		invoice,
		customer: client,
		lines: lines.map((l) => ({
			...l.line,
			productType: l.productType,
			productActive: l.productActive
		})),
		settlements,
		creditNotes,
		creditedInvoice: credited[0] ?? null,
		repair: repair[0] ?? null,
		paid,
		credited: creditedTotal,
		remaining: remainingDue(Number(invoice.totalTtc), paid, creditedTotal)
	};
}

/** Factures d'un client, pour sa fiche. */
export function listCustomerCounterInvoices(customerId: number) {
	return db
		.select({
			id: counterInvoice.id,
			kind: counterInvoice.kind,
			number: counterInvoice.number,
			status: counterInvoice.status,
			issuedOn: counterInvoice.issuedOn,
			totalTtc: counterInvoice.totalTtc
		})
		.from(counterInvoice)
		.where(eq(counterInvoice.customerId, customerId))
		.orderBy(desc(counterInvoice.id))
		.limit(50);
}

/** Factures d'un ordre de réparation, pour sa fiche. */
export function listRepairCounterInvoices(repairOrderId: number) {
	return db
		.select({ id: counterInvoice.id, number: counterInvoice.number, status: counterInvoice.status })
		.from(counterInvoice)
		.where(and(eq(counterInvoice.repairOrderId, repairOrderId), eq(counterInvoice.kind, 'invoice')))
		.orderBy(asc(counterInvoice.id));
}

/**
 * Produits et prestations à facturer : tout le catalogue, en ligne ou non
 * (les prestations de main-d'œuvre sont hors boutique). Un EAN complet
 * cherche l'EAN exact ; sinon chaque mot doit figurer dans le nom ou la référence.
 */
export async function searchBillableProducts(term: string, limit = 15) {
	const q = term.trim();
	if (q.length < 2) return [];
	const where = /^\d{8,13}$/.test(q)
		? or(eq(product.ean13, q), eq(product.reference, q))
		: and(
				...q
					.split(/\s+/)
					.map((w) => or(ilike(product.name, `%${w}%`), ilike(product.reference, `%${w}%`)))
			);
	return (
		db
			.select({
				id: product.id,
				name: product.name,
				reference: product.reference,
				type: product.type,
				stock: product.stock,
				isActive: product.isActive,
				priceHt: product.priceHt,
				taxRate: sql<string>`coalesce(${taxRule.rate}, 0)::text`
			})
			.from(product)
			.leftJoin(taxRule, eq(taxRule.id, product.taxRuleId))
			.where(where)
			// Les prestations d'abord : c'est ce qu'on facture le plus au comptoir.
			.orderBy(sql`${product.type} = 'service' desc`, desc(product.stock), asc(product.name))
			.limit(limit)
	);
}

// ===========================================================================
// Brouillon
// ===========================================================================

async function requireDraft(tx: Tx | typeof db, id: number) {
	const [row] = await tx
		.select({ status: counterInvoice.status })
		.from(counterInvoice)
		.where(eq(counterInvoice.id, id));
	if (!row) throw new CounterInvoiceError('Facture introuvable.');
	if (row.status !== 'draft') {
		throw new CounterInvoiceError(
			'Facture validée : elle ne se modifie plus. Corrigez-la par un avoir.'
		);
	}
}

/** Recalcule les totaux du brouillon depuis ses lignes. */
async function refreshTotals(tx: Tx, id: number) {
	const lines = await tx
		.select()
		.from(counterInvoiceLine)
		.where(eq(counterInvoiceLine.invoiceId, id));
	const totals = invoiceTotals(
		lines.map((l) => ({
			quantity: Number(l.quantity),
			unitPriceHt: Number(l.unitPriceHt),
			taxRate: Number(l.taxRate),
			discountPercent: Number(l.discountPercent)
		}))
	);
	await tx
		.update(counterInvoice)
		.set({
			totalHt: totals.totalHt.toFixed(2),
			totalTva: totals.totalTva.toFixed(2),
			totalTtc: totals.totalTtc.toFixed(2),
			taxBreakdown: totals.taxBreakdown,
			updatedAt: new Date()
		})
		.where(eq(counterInvoice.id, id));
}

/** Crée un brouillon de facture pour un client ; renvoie son identifiant. */
export async function createDraft(customerId: number, createdBy: string | null) {
	const [c] = await db
		.select({ id: customer.id })
		.from(customer)
		.where(eq(customer.id, customerId));
	if (!c) throw new CounterInvoiceError('Client introuvable.');
	const [row] = await db
		.insert(counterInvoice)
		.values({ customerId, createdBy })
		.returning({ id: counterInvoice.id });
	return row.id;
}

/** Ligne à créer, sur une facture ou un devis. */
export type NewLine = {
	productId: number | null;
	label: string;
	/** Détail sous la désignation (n° de série, garantie) ; aucun par défaut. */
	description?: string | null;
	reference: string | null;
	quantity: number;
	unitPriceHt: number;
	taxRate: number;
	discountPercent: number;
	accountingCode: string | null;
};

async function insertLines(tx: Tx, invoiceId: number, lines: NewLine[]) {
	if (!lines.length) return;
	const [{ max }] = await tx
		.select({ max: sql<number>`coalesce(max(${counterInvoiceLine.position}), 0)::int` })
		.from(counterInvoiceLine)
		.where(eq(counterInvoiceLine.invoiceId, invoiceId));
	await tx.insert(counterInvoiceLine).values(
		lines.map((l, i) => {
			const t = lineTotals(l);
			return {
				invoiceId,
				position: max + i + 1,
				productId: l.productId,
				label: l.label,
				description: l.description ?? null,
				reference: l.reference,
				quantity: String(l.quantity),
				unitPriceHt: l.unitPriceHt.toFixed(4),
				taxRate: String(l.taxRate),
				discountPercent: String(l.discountPercent),
				totalHt: t.totalHt.toFixed(2),
				totalTva: t.totalTva.toFixed(2),
				totalTtc: t.totalTtc.toFixed(2),
				accountingCode: l.accountingCode
			};
		})
	);
}

/** Ligne d'un produit ou d'une prestation du catalogue, au prix du catalogue. */
export async function catalogLine(
	tx: Tx | typeof db,
	productId: number,
	quantity: number
): Promise<NewLine> {
	const [p] = await tx
		.select({
			name: product.name,
			reference: product.reference,
			priceHt: product.priceHt,
			accountingCode: product.accountingCode,
			rate: taxRule.rate
		})
		.from(product)
		.leftJoin(taxRule, eq(taxRule.id, product.taxRuleId))
		.where(eq(product.id, productId));
	if (!p) throw new CounterInvoiceError('Produit introuvable.');
	return {
		productId,
		label: p.name,
		reference: p.reference,
		quantity,
		unitPriceHt: Number(p.priceHt),
		taxRate: Number(p.rate ?? 20),
		discountPercent: 0,
		accountingCode: p.accountingCode
	};
}

/** Ajoute un produit ou une prestation du catalogue. */
export async function addProductLine(invoiceId: number, productId: number, quantity = 1) {
	await db.transaction(async (tx) => {
		await requireDraft(tx, invoiceId);
		await insertLines(tx, invoiceId, [await catalogLine(tx, productId, quantity)]);
		await refreshTotals(tx, invoiceId);
	});
}

/** Ajoute une ligne libre (pièce hors catalogue, prestation ponctuelle), prix saisi TTC. */
export async function addFreeLine(
	invoiceId: number,
	input: { label: string; quantity: number; priceTtc: number; taxRate: number }
) {
	const label = input.label.replace(/\s+/g, ' ').trim();
	if (!label) throw new CounterInvoiceError('Indiquez la désignation de la ligne.');
	await db.transaction(async (tx) => {
		await requireDraft(tx, invoiceId);
		await insertLines(tx, invoiceId, [
			{
				productId: null,
				label,
				reference: null,
				quantity: input.quantity,
				unitPriceHt: priceHtFromTtc(input.priceTtc, input.taxRate),
				taxRate: input.taxRate,
				discountPercent: 0,
				accountingCode: null
			}
		]);
		await refreshTotals(tx, invoiceId);
	});
}

/** Modifie une ligne : désignation, quantité, prix unitaire TTC, remise, taux. */
export async function updateLine(
	invoiceId: number,
	lineId: number,
	input: {
		label: string;
		description: string;
		quantity: number;
		priceTtc: number;
		discountPercent: number;
		taxRate: number;
	}
) {
	const label = input.label.replace(/\s+/g, ' ').trim();
	if (!label) throw new CounterInvoiceError('Indiquez la désignation de la ligne.');
	if (!Number.isFinite(input.quantity) || input.quantity === 0) {
		throw new CounterInvoiceError('La quantité ne peut pas être nulle.');
	}
	if (!(input.discountPercent >= 0 && input.discountPercent <= 100)) {
		throw new CounterInvoiceError('La remise est un pourcentage entre 0 et 100.');
	}
	await db.transaction(async (tx) => {
		await requireDraft(tx, invoiceId);
		const unitPriceHt = priceHtFromTtc(input.priceTtc, input.taxRate);
		const t = lineTotals({ ...input, unitPriceHt });
		await tx
			.update(counterInvoiceLine)
			.set({
				label,
				description: lineDetail(input.description),
				quantity: String(input.quantity),
				unitPriceHt: unitPriceHt.toFixed(4),
				taxRate: String(input.taxRate),
				discountPercent: String(input.discountPercent),
				totalHt: t.totalHt.toFixed(2),
				totalTva: t.totalTva.toFixed(2),
				totalTtc: t.totalTtc.toFixed(2)
			})
			.where(and(eq(counterInvoiceLine.id, lineId), eq(counterInvoiceLine.invoiceId, invoiceId)));
		await refreshTotals(tx, invoiceId);
	});
}

/**
 * Déduit un crédit disponible du client sur le brouillon : une ligne négative
 * à son montant et à son taux, comme Dolibarr. Supprimer la ligne le libère.
 */
export async function applyCustomerCredit(invoiceId: number, creditId: number) {
	await db.transaction(async (tx) => {
		await requireDraft(tx, invoiceId);
		const [inv] = await tx
			.select({ customerId: counterInvoice.customerId, kind: counterInvoice.kind })
			.from(counterInvoice)
			.where(eq(counterInvoice.id, invoiceId));
		if (inv.kind === 'credit_note') {
			throw new CounterInvoiceError('Un crédit se déduit d’une facture, pas d’un avoir.');
		}
		const [credit] = await tx
			.select()
			.from(customerCredit)
			.where(eq(customerCredit.id, creditId))
			.for('update');
		if (!credit || credit.customerId !== inv.customerId) {
			throw new CounterInvoiceError('Crédit introuvable pour ce client.');
		}
		if (credit.usedLineId || credit.usedInvoiceId) {
			throw new CounterInvoiceError('Ce crédit a déjà été utilisé.');
		}
		const [{ max }] = await tx
			.select({ max: sql<number>`coalesce(max(${counterInvoiceLine.position}), 0)::int` })
			.from(counterInvoiceLine)
			.where(eq(counterInvoiceLine.invoiceId, invoiceId));
		const line = {
			quantity: 1,
			unitPriceHt: -Number(credit.amountHt),
			taxRate: Number(credit.taxRate),
			discountPercent: 0
		};
		const t = lineTotals(line);
		const [row] = await tx
			.insert(counterInvoiceLine)
			.values({
				invoiceId,
				position: max + 1,
				productId: null,
				label: credit.description,
				quantity: '1',
				unitPriceHt: line.unitPriceHt.toFixed(4),
				taxRate: String(line.taxRate),
				discountPercent: '0',
				totalHt: t.totalHt.toFixed(2),
				totalTva: t.totalTva.toFixed(2),
				totalTtc: t.totalTtc.toFixed(2)
			})
			.returning({ id: counterInvoiceLine.id });
		await tx
			.update(customerCredit)
			.set({ usedLineId: row.id })
			.where(eq(customerCredit.id, creditId));
		await refreshTotals(tx, invoiceId);
	});
}

export async function deleteLine(invoiceId: number, lineId: number) {
	await db.transaction(async (tx) => {
		await requireDraft(tx, invoiceId);
		await tx
			.delete(counterInvoiceLine)
			.where(and(eq(counterInvoiceLine.id, lineId), eq(counterInvoiceLine.invoiceId, invoiceId)));
		await refreshTotals(tx, invoiceId);
	});
}

/** En-tête du brouillon : client, date, notes. */
export async function updateHeader(
	invoiceId: number,
	input: {
		customerId: number;
		issuedOn: string | null;
		customerReference: string | null;
		paymentTerms: PaymentTerms;
		paymentMethod: SettlementMethod | null;
		bankAccount: string;
		note: string | null;
		privateNote: string | null;
	}
) {
	await requireDraft(db, invoiceId);
	await db
		.update(counterInvoice)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(counterInvoice.id, invoiceId));
}

/** Supprime un brouillon (un brouillon n'a pas de numéro : rien à conserver). */
export async function deleteDraft(invoiceId: number) {
	await requireDraft(db, invoiceId);
	await db.delete(counterInvoice).where(eq(counterInvoice.id, invoiceId));
}

/**
 * Brouillon depuis un ordre de réparation : ses pièces, sa main-d'œuvre et
 * ses frais de diagnostic. Les règlements déjà saisis sur l'ordre comptent
 * pour la facture. Une seule facture par ordre.
 */
export async function createDraftFromRepair(repairOrderId: number, createdBy: string | null) {
	const [order] = await db.select().from(repairOrder).where(eq(repairOrder.id, repairOrderId));
	if (!order) throw new CounterInvoiceError('Ordre de réparation introuvable.');
	const [existing] = await db
		.select({ id: counterInvoice.id })
		.from(counterInvoice)
		.where(
			and(
				eq(counterInvoice.repairOrderId, repairOrderId),
				eq(counterInvoice.kind, 'invoice'),
				sql`${counterInvoice.status} <> 'abandoned'`
			)
		);
	if (existing) return existing.id;

	const parts = await db
		.select()
		.from(repairOrderPart)
		.where(eq(repairOrderPart.repairOrderId, repairOrderId))
		.orderBy(asc(repairOrderPart.id));
	return db.transaction(async (tx) => {
		const lines: NewLine[] = [];
		for (const part of parts) {
			const base = part.productId ? await catalogLine(tx, part.productId, part.quantity) : null;
			lines.push({
				productId: part.productId,
				label: part.partName,
				reference: part.partReference,
				quantity: part.quantity,
				unitPriceHt: Number(part.unitPriceHt),
				taxRate: base?.taxRate ?? 20,
				discountPercent: 0,
				accountingCode: base?.accountingCode ?? null
			});
		}
		for (const [label, amount] of [
			["Main-d'œuvre", Number(order.laborAmount)],
			['Frais de diagnostic', Number(order.diagnosticFee)]
		] as const) {
			if (amount > 0) {
				lines.push({
					productId: null,
					label,
					reference: null,
					quantity: 1,
					unitPriceHt: amount,
					taxRate: 20,
					discountPercent: 0,
					accountingCode: null
				});
			}
		}
		return createDraftWithLines(
			tx,
			{
				customerId: order.customerId,
				repairOrderId,
				createdBy,
				note: `Ordre de réparation ${order.reference}`
			},
			lines
		);
	});
}

/** Brouillon de facture et ses lignes, totaux calculés : depuis un ordre ou un devis. */
export async function createDraftWithLines(
	tx: Tx,
	values: Pick<
		typeof counterInvoice.$inferInsert,
		'customerId' | 'repairOrderId' | 'createdBy' | 'note' | 'customerReference'
	>,
	lines: NewLine[]
) {
	const [row] = await tx.insert(counterInvoice).values(values).returning({ id: counterInvoice.id });
	await insertLines(tx, row.id, lines);
	await refreshTotals(tx, row.id);
	return row.id;
}

// ===========================================================================
// Validation, règlements, avoirs
// ===========================================================================

/** Adresse de facturation du client, figée sur la facture ou le devis. */
export async function billingAddressOf(
	tx: Tx | typeof db,
	customerId: number
): Promise<CounterBillingAddress> {
	const [c] = await tx.select().from(customer).where(eq(customer.id, customerId));
	const [a] = await tx
		.select()
		.from(address)
		.where(eq(address.customerId, customerId))
		.orderBy(desc(address.isDefaultBilling), desc(address.id))
		.limit(1);
	return {
		name: [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim(),
		company: c?.companyName ?? a?.company ?? null,
		line1: a?.line1 ?? null,
		line2: a?.line2 ?? null,
		postalCode: a?.postalCode ?? null,
		city: a?.city ?? null,
		country: a?.country ?? c?.billingCountry ?? 'FR',
		phone: c?.phone ?? a?.phone ?? null,
		email: c?.email ?? null,
		siret: c?.siret ?? null,
		vatNumber: c?.vatNumber ?? null
	};
}

/**
 * Valide un brouillon : numéro de la série (FA ou AV), date, adresse et totaux
 * figés. Le numéro vient d'une séquence Postgres : jamais deux fois le même.
 */
export async function validateInvoice(id: number, userId: string | null) {
	await db.transaction(async (tx) => {
		const [inv] = await tx
			.select()
			.from(counterInvoice)
			.where(eq(counterInvoice.id, id))
			.for('update');
		if (!inv) throw new CounterInvoiceError('Facture introuvable.');
		if (inv.status !== 'draft') throw new CounterInvoiceError('Cette facture est déjà validée.');
		const [{ lines }] = await tx
			.select({ lines: sql<number>`count(*)::int` })
			.from(counterInvoiceLine)
			.where(eq(counterInvoiceLine.invoiceId, id));
		if (!lines) throw new CounterInvoiceError('Ajoutez au moins une ligne avant de valider.');

		const isCredit = inv.kind === 'credit_note';
		const seq = isCredit ? 'counter_credit_note_number_seq' : 'counter_invoice_number_seq';
		const [{ n }] = await tx.execute<{ n: string }>(sql`select nextval(${seq})::text as n`);
		const now = new Date();
		const issuedOn = inv.issuedOn ?? now.toISOString().slice(0, 10);
		await refreshTotals(tx, id);
		await tx
			.update(counterInvoice)
			.set({
				number: formatCounterNumber(isCredit ? 'AV' : 'FA', now, Number(n)),
				// Un avoir n'attend pas de règlement : il solde (en partie) sa facture.
				status: isCredit ? 'paid' : 'validated',
				issuedOn,
				dueOn: isCredit ? null : dueDate(issuedOn, inv.paymentTerms),
				billingAddress: await billingAddressOf(tx, inv.customerId),
				validatedAt: now,
				validatedBy: userId,
				updatedAt: now
			})
			.where(eq(counterInvoice.id, id));
	});
	const [inv] = await db.select().from(counterInvoice).where(eq(counterInvoice.id, id));
	await refreshPaidStatus(inv.creditedInvoiceId ?? id);
}

/** Passe une facture « payée » quand règlements et avoirs couvrent le total, « impayée » sinon. */
async function refreshPaidStatus(id: number) {
	const found = await getCounterInvoice(id);
	if (!found || found.invoice.kind !== 'invoice') return;
	const { invoice, remaining } = found;
	if (invoice.status !== 'validated' && invoice.status !== 'paid') return;
	const status: CounterInvoiceStatus = remaining <= 0 ? 'paid' : 'validated';
	if (status !== invoice.status) {
		await db
			.update(counterInvoice)
			.set({ status, updatedAt: new Date() })
			.where(eq(counterInvoice.id, id));
	}
}

/** Enregistre un règlement, dans la limite du reste dû. */
export async function recordInvoicePayment(
	id: number,
	input: SettlementInput,
	actor: string | null
) {
	const found = await getCounterInvoice(id);
	if (!found) throw new CounterInvoiceError('Facture introuvable.');
	const { invoice, remaining } = found;
	if (invoice.kind !== 'invoice' || invoice.status === 'draft') {
		throw new CounterInvoiceError('Validez la facture avant d’enregistrer un règlement.');
	}
	if (invoice.status === 'abandoned') throw new CounterInvoiceError('Facture abandonnée.');
	if (remaining <= 0) throw new CounterInvoiceError('Cette facture est déjà réglée.');
	if (Number(input.amount) > remaining) {
		throw new CounterInvoiceError(
			`Le montant dépasse le reste à payer (${formatPrice(remaining)}).`
		);
	}
	await db.transaction(async (tx) => {
		// Identifiant réservé d'abord : la référence en dépend.
		const [{ sid }] = await tx.execute<{ sid: number }>(
			sql`select nextval(pg_get_serial_sequence('settlement', 'id'))::int as sid`
		);
		await tx.insert(settlement).values({
			id: sid,
			reference: buildSettlementReference(sid, input.receivedOn),
			method: input.method,
			amount: input.amount,
			receivedOn: input.receivedOn,
			chequeNumber: input.chequeNumber,
			chequeIssuer: input.chequeIssuer,
			chequeBank: input.chequeBank,
			counterInvoiceId: id,
			// Facture d'un ordre de réparation : l'ordre est réglé du même coup.
			repairOrderId: invoice.repairOrderId,
			createdBy: actor
		});
	});
	await refreshPaidStatus(id);
}

/**
 * Crée l'avoir d'une facture validée : un brouillon qui reprend ses lignes en
 * négatif, à ajuster (avoir partiel) avant validation.
 */
export async function createCreditNote(invoiceId: number, createdBy: string | null) {
	const found = await getCounterInvoice(invoiceId);
	if (!found) throw new CounterInvoiceError('Facture introuvable.');
	if (found.invoice.kind !== 'invoice' || found.invoice.status === 'draft') {
		throw new CounterInvoiceError('Seule une facture validée se corrige par un avoir.');
	}
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(counterInvoice)
			.values({
				kind: 'credit_note',
				customerId: found.invoice.customerId,
				creditedInvoiceId: invoiceId,
				note: `Avoir sur la facture ${found.invoice.number}`,
				createdBy
			})
			.returning({ id: counterInvoice.id });
		await insertLines(
			tx,
			row.id,
			found.lines.map((l) => ({
				productId: l.productId,
				label: l.label,
				description: l.description,
				reference: l.reference,
				quantity: -Number(l.quantity),
				unitPriceHt: Number(l.unitPriceHt),
				taxRate: Number(l.taxRate),
				discountPercent: Number(l.discountPercent),
				accountingCode: l.accountingCode
			}))
		);
		await refreshTotals(tx, row.id);
		return row.id;
	});
}

/** Classe une facture validée « abandonnée » : le reste dû ne sera pas encaissé. */
export async function abandonInvoice(id: number, reason: string) {
	const motive = reason.trim();
	if (!motive) throw new CounterInvoiceError('Indiquez la raison de l’abandon.');
	const [inv] = await db.select().from(counterInvoice).where(eq(counterInvoice.id, id));
	if (!inv || inv.kind !== 'invoice' || inv.status !== 'validated') {
		throw new CounterInvoiceError('Seule une facture validée et impayée peut être abandonnée.');
	}
	await db
		.update(counterInvoice)
		.set({ status: 'abandoned', abandonReason: motive, updatedAt: new Date() })
		.where(eq(counterInvoice.id, id));
}

/** Clients proposés à la facturation, filtrés par la recherche saisie. */
export async function searchInvoiceCustomers(term: string) {
	const q = term.trim();
	if (q.length < 2) return [];
	const like = `%${q}%`;
	return db
		.select({
			id: customer.id,
			firstName: customer.firstName,
			lastName: customer.lastName,
			email: customer.email,
			companyName: customer.companyName,
			phone: customer.phone,
			userId: customer.userId
		})
		.from(customer)
		.where(
			or(
				ilike(customer.lastName, like),
				ilike(customer.firstName, like),
				ilike(customer.email, like),
				ilike(customer.companyName, like),
				ilike(customer.alias, like),
				ilike(customer.phone, like)
			)
		)
		.orderBy(sql`${customer.lastName} NULLS LAST`)
		.limit(20);
}

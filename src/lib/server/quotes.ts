/**
 * Devis (CDC 23 ; remplacement des propositions commerciales Dolibarr, voir
 * `MIGRATION-DOLIBARR.md`), sur les clients, produits et prestations de MSShop.
 *
 * Cycle d'un devis :
 * 1. **brouillon** : client, lignes, remises, durée de validité — tout se
 *    modifie, rien n'est visible du client (R2) ;
 * 2. **envoi** : numéro dans la série Dolibarr (`PR2611-0322`), date limite,
 *    totaux et adresse figés (R5 : une correction passe par un nouveau devis,
 *    « Dupliquer ») ;
 * 3. **décision** du client, enregistrée par l'équipe : accepté ou refusé ;
 *    passé la date limite, il a expiré et ne s'accepte plus (R4) ;
 * 4. **facturation** : un devis accepté devient un brouillon de facture
 *    comptoir, une seule fois (R10, R11).
 *
 * Lignes et totaux se calculent comme ceux des factures comptoir.
 */
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customer } from '$lib/server/db/customer.schema';
import { product } from '$lib/server/db/catalog.schema';
import { repairOrder } from '$lib/server/db/repair.schema';
import { counterInvoice } from '$lib/server/db/counter-invoice.schema';
import { quote, quoteLine } from '$lib/server/db/quote.schema';
import {
	formatCounterNumber,
	invoiceTotals,
	lineTotals,
	priceHtFromTtc
} from '$lib/counter-invoices';
import { DEFAULT_VALIDITY_DAYS, quoteStatus, validUntilOf } from '$lib/quotes';
import {
	billingAddressOf,
	catalogLine,
	createDraftWithLines,
	type NewLine,
	type Tx
} from '$lib/server/counter-invoices';

/** Règle métier non respectée : le message est destiné à l'utilisateur. */
export class QuoteError extends Error {}

const today = () => new Date().toISOString().slice(0, 10);

/** Devis envoyé dont la date limite est passée (R4). */
const expiredSql = sql`(${quote.status} = 'sent' and ${quote.validUntil} < current_date)`;

// ===========================================================================
// Lecture
// ===========================================================================

export type QuoteListFilter = 'all' | 'draft' | 'open' | 'accepted' | 'invoiced' | 'lost';

/** Devis, du plus récent au plus ancien. */
export async function listQuotes(filter: QuoteListFilter, term: string, limit = 200) {
	const where: SQL[] = [];
	if (filter === 'draft') where.push(eq(quote.status, 'draft'));
	if (filter === 'open') where.push(eq(quote.status, 'sent'), sql`not ${expiredSql}`);
	if (filter === 'accepted') where.push(eq(quote.status, 'accepted'));
	if (filter === 'invoiced') where.push(eq(quote.status, 'invoiced'));
	if (filter === 'lost') where.push(or(eq(quote.status, 'rejected'), expiredSql)!);
	const q = term.trim();
	if (q) {
		const like = `%${q}%`;
		where.push(
			or(
				ilike(quote.number, like),
				ilike(customer.lastName, like),
				ilike(customer.firstName, like),
				ilike(customer.companyName, like),
				ilike(customer.email, like)
			)!
		);
	}
	const rows = await db
		.select({
			id: quote.id,
			number: quote.number,
			status: quote.status,
			validUntil: quote.validUntil,
			issuedOn: quote.issuedOn,
			createdAt: quote.createdAt,
			totalTtc: quote.totalTtc,
			invoiceId: quote.invoiceId,
			customerId: customer.id,
			customerName: sql<string>`coalesce(nullif(${customer.companyName}, ''), trim(concat(${customer.firstName}, ' ', ${customer.lastName})))`,
			legacyDoliId: quote.legacyDoliId
		})
		.from(quote)
		.innerJoin(customer, eq(customer.id, quote.customerId))
		.where(where.length ? and(...where) : undefined)
		.orderBy(desc(sql`coalesce(${quote.issuedOn}, ${quote.createdAt}::date)`), desc(quote.id))
		.limit(limit);
	const now = today();
	return rows.map((r) => ({ ...r, displayStatus: quoteStatus(r, now) }));
}

/** En cours (envoyés, non expirés) et acceptés à facturer : nombre et montant. */
export async function quoteSummary() {
	const [row] = await db
		.select({
			openCount: sql<number>`count(*) filter (where ${quote.status} = 'sent' and not ${expiredSql})::int`,
			openTotal: sql<string>`coalesce(sum(${quote.totalTtc}) filter (where ${quote.status} = 'sent' and not ${expiredSql}), 0)::text`,
			acceptedCount: sql<number>`count(*) filter (where ${quote.status} = 'accepted')::int`,
			acceptedTotal: sql<string>`coalesce(sum(${quote.totalTtc}) filter (where ${quote.status} = 'accepted'), 0)::text`
		})
		.from(quote);
	return row;
}

/** Un devis, son client, ses lignes, la facture et l'ordre de réparation liés. */
export async function getQuote(id: number) {
	const [head] = await db.select().from(quote).where(eq(quote.id, id));
	if (!head) return null;
	const [[client], lines, invoice, repair] = await Promise.all([
		db.select().from(customer).where(eq(customer.id, head.customerId)),
		db
			.select({ line: quoteLine, productType: product.type })
			.from(quoteLine)
			.leftJoin(product, eq(product.id, quoteLine.productId))
			.where(eq(quoteLine.quoteId, id))
			.orderBy(asc(quoteLine.position), asc(quoteLine.id)),
		head.invoiceId
			? db
					.select({ id: counterInvoice.id, number: counterInvoice.number })
					.from(counterInvoice)
					.where(eq(counterInvoice.id, head.invoiceId))
			: [],
		head.repairOrderId
			? db
					.select({ id: repairOrder.id, reference: repairOrder.reference })
					.from(repairOrder)
					.where(eq(repairOrder.id, head.repairOrderId))
			: []
	]);
	return {
		quote: head,
		displayStatus: quoteStatus(head, today()),
		customer: client,
		lines: lines.map((l) => ({ ...l.line, productType: l.productType })),
		invoice: invoice[0] ?? null,
		repair: repair[0] ?? null
	};
}

/** Devis d'un client, pour sa fiche. */
export async function listCustomerQuotes(customerId: number) {
	const rows = await db
		.select({
			id: quote.id,
			number: quote.number,
			status: quote.status,
			validUntil: quote.validUntil,
			issuedOn: quote.issuedOn,
			totalTtc: quote.totalTtc
		})
		.from(quote)
		.where(eq(quote.customerId, customerId))
		.orderBy(desc(quote.id))
		.limit(50);
	const now = today();
	return rows.map((r) => ({ ...r, displayStatus: quoteStatus(r, now) }));
}

/** Devis dont une facture est issue, pour la fiche de la facture. */
export async function quoteOfInvoice(invoiceId: number) {
	const [row] = await db
		.select({ id: quote.id, number: quote.number })
		.from(quote)
		.where(eq(quote.invoiceId, invoiceId));
	return row ?? null;
}

// ===========================================================================
// Brouillon
// ===========================================================================

async function requireDraft(tx: Tx | typeof db, id: number) {
	const [row] = await tx.select({ status: quote.status }).from(quote).where(eq(quote.id, id));
	if (!row) throw new QuoteError('Devis introuvable.');
	if (row.status !== 'draft') {
		throw new QuoteError('Devis envoyé : il ne se modifie plus. Dupliquez-le pour le corriger.');
	}
}

/** Recalcule les totaux du brouillon depuis ses lignes (R8). */
async function refreshTotals(tx: Tx, id: number) {
	const lines = await tx.select().from(quoteLine).where(eq(quoteLine.quoteId, id));
	const totals = invoiceTotals(
		lines.map((l) => ({
			quantity: Number(l.quantity),
			unitPriceHt: Number(l.unitPriceHt),
			taxRate: Number(l.taxRate),
			discountPercent: Number(l.discountPercent)
		}))
	);
	await tx
		.update(quote)
		.set({
			totalHt: totals.totalHt.toFixed(2),
			totalTva: totals.totalTva.toFixed(2),
			totalTtc: totals.totalTtc.toFixed(2),
			taxBreakdown: totals.taxBreakdown,
			updatedAt: new Date()
		})
		.where(eq(quote.id, id));
}

async function insertLines(tx: Tx, quoteId: number, lines: NewLine[]) {
	if (!lines.length) return;
	const [{ max }] = await tx
		.select({ max: sql<number>`coalesce(max(${quoteLine.position}), 0)::int` })
		.from(quoteLine)
		.where(eq(quoteLine.quoteId, quoteId));
	await tx.insert(quoteLine).values(
		lines.map((l, i) => {
			const t = lineTotals(l);
			return {
				quoteId,
				position: max + i + 1,
				productId: l.productId,
				label: l.label,
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

/** Lignes d'un devis, à recopier sur un autre document. */
async function linesOf(id: number): Promise<NewLine[]> {
	const lines = await db
		.select()
		.from(quoteLine)
		.where(eq(quoteLine.quoteId, id))
		.orderBy(asc(quoteLine.position), asc(quoteLine.id));
	return lines.map((l) => ({
		productId: l.productId,
		label: l.label,
		reference: l.reference,
		quantity: Number(l.quantity),
		unitPriceHt: Number(l.unitPriceHt),
		taxRate: Number(l.taxRate),
		discountPercent: Number(l.discountPercent),
		accountingCode: l.accountingCode
	}));
}

/** Crée un devis brouillon pour un client ; renvoie son identifiant. */
export async function createQuote(customerId: number, createdBy: string | null) {
	const [c] = await db
		.select({ id: customer.id })
		.from(customer)
		.where(eq(customer.id, customerId));
	if (!c) throw new QuoteError('Client introuvable.');
	const [row] = await db
		.insert(quote)
		.values({ customerId, createdBy })
		.returning({ id: quote.id });
	return row.id;
}

/** Ajoute un produit ou une prestation du catalogue. */
export async function addProductLine(quoteId: number, productId: number, quantity = 1) {
	await db.transaction(async (tx) => {
		await requireDraft(tx, quoteId);
		await insertLines(tx, quoteId, [await catalogLine(tx, productId, quantity)]);
		await refreshTotals(tx, quoteId);
	});
}

/** Ajoute une ligne libre (R6), prix saisi TTC. */
export async function addFreeLine(
	quoteId: number,
	input: { label: string; quantity: number; priceTtc: number; taxRate: number }
) {
	const label = input.label.replace(/\s+/g, ' ').trim();
	if (!label) throw new QuoteError('Indiquez la désignation de la ligne.');
	await db.transaction(async (tx) => {
		await requireDraft(tx, quoteId);
		await insertLines(tx, quoteId, [
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
		await refreshTotals(tx, quoteId);
	});
}

/** Modifie une ligne : désignation, quantité, prix unitaire TTC, remise, taux (R7). */
export async function updateLine(
	quoteId: number,
	lineId: number,
	input: {
		label: string;
		quantity: number;
		priceTtc: number;
		discountPercent: number;
		taxRate: number;
	}
) {
	const label = input.label.replace(/\s+/g, ' ').trim();
	if (!label) throw new QuoteError('Indiquez la désignation de la ligne.');
	if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
		throw new QuoteError('La quantité doit être positive.');
	}
	if (!(input.discountPercent >= 0 && input.discountPercent <= 100)) {
		throw new QuoteError('La remise est un pourcentage entre 0 et 100.');
	}
	await db.transaction(async (tx) => {
		await requireDraft(tx, quoteId);
		const unitPriceHt = priceHtFromTtc(input.priceTtc, input.taxRate);
		const t = lineTotals({ ...input, unitPriceHt });
		await tx
			.update(quoteLine)
			.set({
				label,
				quantity: String(input.quantity),
				unitPriceHt: unitPriceHt.toFixed(4),
				taxRate: String(input.taxRate),
				discountPercent: String(input.discountPercent),
				totalHt: t.totalHt.toFixed(2),
				totalTva: t.totalTva.toFixed(2),
				totalTtc: t.totalTtc.toFixed(2)
			})
			.where(and(eq(quoteLine.id, lineId), eq(quoteLine.quoteId, quoteId)));
		await refreshTotals(tx, quoteId);
	});
}

export async function deleteLine(quoteId: number, lineId: number) {
	await db.transaction(async (tx) => {
		await requireDraft(tx, quoteId);
		await tx.delete(quoteLine).where(and(eq(quoteLine.id, lineId), eq(quoteLine.quoteId, quoteId)));
		await refreshTotals(tx, quoteId);
	});
}

/** En-tête du brouillon : date, durée de validité, notes. */
export async function updateHeader(
	quoteId: number,
	input: {
		issuedOn: string | null;
		validityDays: number;
		note: string | null;
		privateNote: string | null;
	}
) {
	if (!Number.isInteger(input.validityDays) || input.validityDays < 1) {
		throw new QuoteError('La durée de validité est un nombre de jours, au moins 1.');
	}
	await requireDraft(db, quoteId);
	await db
		.update(quote)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(quote.id, quoteId));
}

/** Supprime un brouillon : sans numéro, il n'a jamais été transmis. */
export async function deleteDraft(quoteId: number) {
	await requireDraft(db, quoteId);
	await db.delete(quote).where(eq(quote.id, quoteId));
}

/**
 * Nouveau brouillon reprenant client, lignes et notes d'un devis : c'est ainsi
 * qu'on corrige un devis envoyé (R5).
 */
export async function duplicateQuote(id: number, createdBy: string | null) {
	const [head] = await db.select().from(quote).where(eq(quote.id, id));
	if (!head) throw new QuoteError('Devis introuvable.');
	const lines = await linesOf(id);
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(quote)
			.values({
				customerId: head.customerId,
				repairOrderId: head.repairOrderId,
				validityDays: head.validityDays,
				note: head.note,
				privateNote: head.privateNote,
				createdBy
			})
			.returning({ id: quote.id });
		await insertLines(tx, row.id, lines);
		await refreshTotals(tx, row.id);
		return row.id;
	});
}

// ===========================================================================
// Envoi, décision, facturation
// ===========================================================================

/**
 * Envoie un brouillon : numéro de la série PR (séquence Postgres, jamais deux
 * fois le même), date d'émission, date limite, adresse et totaux figés.
 * Le PDF se télécharge ensuite pour être transmis au client.
 */
export async function sendQuote(id: number, userId: string | null) {
	await db.transaction(async (tx) => {
		const [head] = await tx.select().from(quote).where(eq(quote.id, id)).for('update');
		if (!head) throw new QuoteError('Devis introuvable.');
		if (head.status !== 'draft') throw new QuoteError('Ce devis est déjà envoyé.');
		const [{ lines }] = await tx
			.select({ lines: sql<number>`count(*)::int` })
			.from(quoteLine)
			.where(eq(quoteLine.quoteId, id));
		if (!lines) throw new QuoteError('Ajoutez au moins une ligne avant d’envoyer le devis.');

		const [{ n }] = await tx.execute<{ n: string }>(
			sql`select nextval('quote_number_seq')::text as n`
		);
		const now = new Date();
		const issuedOn = head.issuedOn ?? today();
		await refreshTotals(tx, id);
		await tx
			.update(quote)
			.set({
				number: formatCounterNumber('PR', now, Number(n)),
				status: 'sent',
				issuedOn,
				validUntil: validUntilOf(issuedOn, head.validityDays || DEFAULT_VALIDITY_DAYS),
				billingAddress: await billingAddressOf(tx, head.customerId),
				sentAt: now,
				sentBy: userId,
				updatedAt: now
			})
			.where(eq(quote.id, id));
	});
}

/** Enregistre la décision du client (R9). Un devis expiré ne s'accepte plus (R4). */
export async function decideQuote(id: number, decision: 'accepted' | 'rejected', note: string) {
	const found = await getQuote(id);
	if (!found) throw new QuoteError('Devis introuvable.');
	const { displayStatus } = found;
	if (decision === 'accepted' && displayStatus !== 'sent') {
		throw new QuoteError(
			displayStatus === 'expired'
				? 'Devis expiré : il ne s’accepte plus. Dupliquez-le pour en émettre un nouveau.'
				: 'Seul un devis envoyé peut être accepté.'
		);
	}
	if (decision === 'rejected' && !['sent', 'expired', 'accepted'].includes(displayStatus)) {
		throw new QuoteError('Ce devis ne peut plus être refusé.');
	}
	await db
		.update(quote)
		.set({
			status: decision,
			decisionNote: note.trim() || null,
			decidedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(quote.id, id));
}

/**
 * Transforme un devis accepté en brouillon de facture comptoir, avec toutes
 * ses lignes et ses montants (R10) ; une seule fois (R11). La facture reste à
 * valider depuis sa fiche.
 */
export async function invoiceQuote(id: number, createdBy: string | null) {
	return db.transaction(async (tx) => {
		const [head] = await tx.select().from(quote).where(eq(quote.id, id)).for('update');
		if (!head) throw new QuoteError('Devis introuvable.');
		if (head.invoiceId) throw new QuoteError('Ce devis est déjà facturé.');
		if (head.status !== 'accepted') {
			throw new QuoteError('Enregistrez d’abord l’acceptation du client.');
		}
		const invoiceId = await createDraftWithLines(
			tx,
			{
				customerId: head.customerId,
				repairOrderId: head.repairOrderId,
				createdBy,
				note: `Devis ${head.number}`
			},
			await linesOf(id)
		);
		await tx
			.update(quote)
			.set({ status: 'invoiced', invoiceId, updatedAt: new Date() })
			.where(eq(quote.id, id));
		return invoiceId;
	});
}

/**
 * Crédits des clients (les « remises » de Dolibarr) : acompte, avoir,
 * trop-perçu, reprise de machine, remise commerciale. L'équipe en ajoute un
 * sur la fiche client ; il se déduit ensuite d'une facture en brouillon
 * (`applyCustomerCredit`).
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import {
	counterInvoice,
	counterInvoiceLine,
	customerCredit
} from '$lib/server/db/counter-invoice.schema';
import type { ParseResult } from '$lib/server/forms';
import { round2 } from '$lib/money';
import { priceHtFromTtc } from '$lib/counter-invoices';

const sourceInvoice = alias(counterInvoice, 'source_invoice');
const usedInvoice = alias(counterInvoice, 'used_invoice');

/** Crédits d'un client, disponibles d'abord, avec la facture d'origine et celle qui l'a utilisé. */
export async function listCustomerCredits(customerId: number) {
	const rows = await db
		.select({
			credit: customerCredit,
			sourceNumber: sourceInvoice.number,
			usedInvoiceId: usedInvoice.id,
			usedNumber: usedInvoice.number
		})
		.from(customerCredit)
		.leftJoin(sourceInvoice, eq(sourceInvoice.id, customerCredit.sourceInvoiceId))
		.leftJoin(counterInvoiceLine, eq(counterInvoiceLine.id, customerCredit.usedLineId))
		.leftJoin(
			usedInvoice,
			eq(
				usedInvoice.id,
				sql`coalesce(${customerCredit.usedInvoiceId}, ${counterInvoiceLine.invoiceId})`
			)
		)
		.where(eq(customerCredit.customerId, customerId))
		.orderBy(desc(customerCredit.createdAt), desc(customerCredit.id));
	return rows.map((r) => ({
		...r.credit,
		sourceNumber: r.sourceNumber,
		usedInvoiceId: r.usedInvoiceId,
		usedNumber: r.usedNumber,
		isAvailable: !r.credit.usedLineId && !r.credit.usedInvoiceId
	}));
}

/** Crédits encore disponibles d'un client. */
export function availableCredits(customerId: number) {
	return db
		.select()
		.from(customerCredit)
		.where(
			and(
				eq(customerCredit.customerId, customerId),
				isNull(customerCredit.usedLineId),
				isNull(customerCredit.usedInvoiceId)
			)
		)
		.orderBy(customerCredit.createdAt);
}

export type CreditInput = { description: string; amountTtc: number; taxRate: number };

export function parseCreditForm(form: FormData): ParseResult<CreditInput> {
	const description = form.get('description')?.toString().trim() ?? '';
	const amountTtc = Number(String(form.get('amountTtc') ?? '').replace(',', '.'));
	const taxRate = Number(String(form.get('taxRate') ?? '20').replace(',', '.'));
	if (!description) return { ok: false, error: 'Indiquez le motif du crédit.' };
	if (!(amountTtc > 0)) return { ok: false, error: 'Le montant TTC doit être positif.' };
	if (!Number.isFinite(taxRate) || taxRate < 0)
		return { ok: false, error: 'Taux de TVA invalide.' };
	return { ok: true, values: { description, amountTtc, taxRate } };
}

/** Nouveau crédit saisi à la main (reprise de machine, remise commerciale). */
export async function addCustomerCredit(
	customerId: number,
	input: CreditInput,
	createdBy: string | null
) {
	const amountHt = round2(priceHtFromTtc(input.amountTtc, input.taxRate));
	await db.insert(customerCredit).values({
		customerId,
		description: input.description,
		amountHt: amountHt.toFixed(2),
		amountTva: round2(input.amountTtc - amountHt).toFixed(2),
		amountTtc: input.amountTtc.toFixed(2),
		taxRate: String(input.taxRate),
		createdBy
	});
}

/** Supprime un crédit saisi à la main et encore disponible. */
export async function deleteCustomerCredit(customerId: number, creditId: number) {
	await db
		.delete(customerCredit)
		.where(
			and(
				eq(customerCredit.id, creditId),
				eq(customerCredit.customerId, customerId),
				isNull(customerCredit.usedLineId),
				isNull(customerCredit.usedInvoiceId),
				isNull(customerCredit.sourceInvoiceId),
				isNull(customerCredit.legacyDoliId)
			)
		);
}

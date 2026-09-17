import { db } from '$lib/server/db';
import { order, orderInvoice, orderLine, orderPayment } from '$lib/server/db/order.schema';
import type { InvoiceTaxLine } from '$lib/server/db/order.schema';
import { customer } from '$lib/server/db/customer.schema';
import { TAX_MENTIONS, type TaxRegime } from '$lib/tax';
import { desc, eq, sql } from 'drizzle-orm';

/**
 * Facturation (CDC 24).
 *
 * Deux garanties portent tout le module :
 *
 * 1. **Le numéro est unique et jamais réutilisé** (R1, R2). Il vient d'une
 *    séquence Postgres, pas d'un `max() + 1` applicatif qui produirait des
 *    doublons dès deux commandes simultanées.
 * 2. **Une facture émise ne bouge plus** (R4). Tout ce qui s'imprime est figé
 *    à l'émission : totaux, ventilation de TVA, mention de régime, adresses.
 *    Le client peut changer de statut fiscal ensuite, la facture reste
 *    l'image de la transaction.
 */

/** Préfixe d'affichage, repris de PrestaShop pour ne pas dérouter l'atelier. */
const NUMBER_PREFIX = 'FA';

/** Largeur du numéro, zéros inclus : `25633` s'affiche `#FA025633`. */
const NUMBER_WIDTH = 6;

/**
 * Identité de l'entreprise imprimée en pied de facture.
 *
 * Valeurs reprises des factures PrestaShop en circulation. À déplacer vers le
 * paramétrage entreprise (CDC 41) quand il existera — d'où le regroupement ici
 * plutôt qu'une dispersion dans le gabarit.
 */
export const COMPANY = {
	name: 'MECA SERVICES',
	legalName: 'Meca-Services',
	addressLine: '4, La Merrerie',
	postalCode: '50570',
	city: 'CARANTILLY',
	country: 'France Métropolitaine',
	phone: '0950-922-336',
	rcs: 'R.C.S Coutances',
	siren: '878691294',
	vatNumber: 'FR 51 878 691 294'
} as const;

/** Mise en forme d'un numéro de facture pour l'affichage et les documents. */
export function formatInvoiceNumber(raw: string): string {
	// L'historique migré stocke un entier nu ; on ne préfixe que ce qui en est un.
	return /^\d+$/.test(raw) ? `#${NUMBER_PREFIX}${raw.padStart(NUMBER_WIDTH, '0')}` : `#${raw}`;
}

/** Erreur métier de la facturation, distinguée des pannes techniques. */
export class InvoiceError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Réserve le prochain numéro de facture.
 *
 * `nextval` est atomique et hors transaction : deux émissions simultanées
 * obtiennent deux numéros distincts, et un échec ultérieur consomme le numéro
 * sans le rendre. C'est voulu — R2 admet les ruptures de séquence, mais jamais
 * un numéro réutilisé.
 */
async function nextInvoiceNumber(tx: Tx | typeof db): Promise<string> {
	const result = await tx.execute<{ n: string }>(
		sql`SELECT nextval('order_invoice_number_seq')::text AS n`
	);

	// Selon le pilote, `execute` renvoie soit les lignes, soit un objet `{ rows }`.
	const payload = result as unknown as { n: string }[] | { rows?: { n: string }[] };
	const rows = Array.isArray(payload) ? payload : (payload?.rows ?? []);
	const value = rows[0]?.n;
	if (!value) throw new InvoiceError("La séquence de numérotation n'a pas répondu.");
	return value;
}

/**
 * Ventile la TVA par assiette, comme l'exige le bloc « Détail des taxes ».
 *
 * Les produits et le port sont séparés même à taux identique : c'est ce que
 * montrait la facture PrestaShop, et cela reste juste si un jour les taux
 * divergent.
 */
export function buildTaxBreakdown(input: {
	productsHt: number;
	productsTva: number;
	shippingHt: number;
	shippingTva: number;
}): InvoiceTaxLine[] {
	const lines: InvoiceTaxLine[] = [];

	const push = (label: string, baseHt: number, taxAmount: number) => {
		// Une assiette nulle ne s'imprime pas : elle n'apprend rien au lecteur.
		if (baseHt <= 0 && taxAmount <= 0) return;
		// Taux déduit du couple (base, taxe) : c'est celui réellement appliqué,
		// et non un taux théorique qui pourrait avoir changé depuis.
		const rate = baseHt > 0 ? Math.round((taxAmount / baseHt) * 10000) / 100 : 0;
		lines.push({ label, rate, baseHt, taxAmount });
	};

	push('Produits', input.productsHt, input.productsTva);
	push('Livraison', input.shippingHt, input.shippingTva);
	return lines;
}

/** Arrondi comptable au centime. */
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Reconstitue la ventilation de TVA à partir des totaux d'une commande.
 *
 * Sert à l'émission, mais aussi à l'impression des 24 371 factures reprises de
 * PrestaShop : leur ventilation n'a pas été migrée, et une facture qui affiche
 * « Aucune taxe » sur une commande taxée est fausse.
 *
 * Le port est stocké TTC ; on remonte à son HT via le taux réellement supporté
 * par la commande plutôt que d'y appliquer 20 % en aveugle.
 */
export function splitOrderTax(input: { totalHt: number; totalTva: number; shippingTtc: number }) {
	const impliedRate = input.totalHt > 0 ? input.totalTva / input.totalHt : 0;
	const shippingHt = cents(
		impliedRate > 0 ? input.shippingTtc / (1 + impliedRate) : input.shippingTtc
	);
	const shippingTva = cents(input.shippingTtc - shippingHt);

	return {
		shippingHt,
		shippingTva,
		productsHt: cents(input.totalHt - shippingHt),
		productsTva: cents(input.totalTva - shippingTva)
	};
}

/**
 * Émet la facture d'une commande.
 *
 * Idempotent : une commande déjà facturée renvoie sa facture existante plutôt
 * que d'en créer une seconde. Émettre deux fois pour une même commande
 * gaspillerait un numéro et fausserait la comptabilité.
 */
export async function issueInvoice(orderId: number, tx?: Tx) {
	const runner = tx ?? db;

	const [existing] = await runner
		.select()
		.from(orderInvoice)
		.where(eq(orderInvoice.orderId, orderId))
		.limit(1);
	if (existing) return existing;

	const [row] = await runner
		.select({
			totalHt: order.totalHt,
			totalTva: order.totalTva,
			totalTtc: order.totalTtc,
			shippingFee: order.shippingFee,
			discountAmount: order.discountAmount,
			customerType: customer.type,
			taxExemptStatus: customer.taxExemptStatus,
			billingCountry: customer.billingCountry
		})
		.from(order)
		.leftJoin(customer, eq(customer.id, order.customerId))
		.where(eq(order.id, orderId))
		.limit(1);
	if (!row) throw new InvoiceError('Commande introuvable.');

	const totalHt = Number(row.totalHt ?? 0);
	const totalTva = Number(row.totalTva ?? 0);
	const totalTtc = Number(row.totalTtc ?? 0);

	const shippingTtc = Number(row.shippingFee ?? 0);
	const { shippingHt, shippingTva, productsHt, productsTva } = splitOrderTax({
		totalHt,
		totalTva,
		shippingTtc
	});

	// Régime fiscal : une commande sans TVA alors qu'elle a un montant relève
	// d'une exonération, dont la mention est obligatoire sur le document (R7).
	const regime: TaxRegime =
		totalTva === 0 && totalHt > 0
			? row.taxExemptStatus === 'exempt_eu_b2b'
				? 'reverse_charge_eu'
				: (row.billingCountry ?? 'FR').toUpperCase() === 'FR'
					? 'standard'
					: 'export_outside_eu'
			: 'standard';

	const number = await nextInvoiceNumber(runner);

	const [created] = await runner
		.insert(orderInvoice)
		.values({
			orderId,
			number,
			totalHt: String(totalHt),
			totalTtc: String(totalTtc),
			shippingHt: String(shippingHt),
			shippingTtc: String(shippingTtc),
			discountHt: String(row.discountAmount ?? 0),
			discountTtc: String(row.discountAmount ?? 0),
			taxBreakdown: buildTaxBreakdown({ productsHt, productsTva, shippingHt, shippingTva }),
			taxRegime: regime,
			taxMention: TAX_MENTIONS[regime],
			shopAddress: `${COMPANY.name} - ${COMPANY.addressLine} - ${COMPANY.postalCode} ${COMPANY.city}`,
			issuedAt: new Date()
		})
		.returning();

	if (!created) throw new InvoiceError("La facture n'a pas pu être enregistrée.");
	return created;
}

/** Facture d'une commande, si elle a été émise. */
export async function getInvoiceForOrder(orderId: number) {
	const [row] = await db
		.select()
		.from(orderInvoice)
		.where(eq(orderInvoice.orderId, orderId))
		.limit(1);
	return row ?? null;
}

/** Toutes les données nécessaires à l'impression d'une facture. */
export async function getInvoiceDocument(invoiceId: number) {
	const [head] = await db
		.select({
			invoice: orderInvoice,
			order: order,
			customerType: customer.type,
			companyName: customer.companyName,
			vatNumber: customer.vatNumber
		})
		.from(orderInvoice)
		.innerJoin(order, eq(order.id, orderInvoice.orderId))
		.leftJoin(customer, eq(customer.id, order.customerId))
		.where(eq(orderInvoice.id, invoiceId))
		.limit(1);
	if (!head) return null;

	const lines = await db
		.select()
		.from(orderLine)
		.where(eq(orderLine.orderId, head.order.id))
		.orderBy(orderLine.id);

	const [payment] = await db
		.select({ method: orderPayment.method, amount: orderPayment.amount })
		.from(orderPayment)
		.where(eq(orderPayment.orderId, head.order.id))
		.orderBy(desc(orderPayment.id))
		.limit(1);

	return { ...head, lines, payment: payment ?? null };
}

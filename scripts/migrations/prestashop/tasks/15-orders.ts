/**
 * Import des commandes et de tout ce qui en dépend :
 * `ps_orders` → `order`, `ps_order_detail` → `order_line`,
 * `ps_order_history` → `order_state_history`,
 * `ps_order_invoice` → `order_invoice`, `ps_order_payment` → `order_payment`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Ce que la migration précédente avait perdu (mesuré le 2026-08-10)
 *
 *      commandes    28 582 source → 27 403 base   (1 179 manquantes)
 *      lignes       53 744 source → 51 525 base   (2 219 manquantes)
 *      historique  149 597 source → 27 403 base (122 194 manquants !)
 *      factures     24 337 source →      0 base  (TOUTES manquantes)
 *      paiements    24 350 source →      0 base  (TOUS manquants)
 *
 *  L'historique réduit à une ligne par commande signifie que le **parcours**
 *  de chaque commande était perdu : impossible de savoir quand elle a été
 *  payée, expédiée, remboursée. Factures et paiements sont des pièces
 *  comptables qui ne se reconstituent pas.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Choix d'implémentation ─────────────────────────────────────────────────
 *
 *  **Les adresses sont figées, pas référencées.** `order.shipping_address` et
 *  `billing_address` sont des colonnes JSON : une commande doit conserver
 *  l'adresse **telle qu'elle était au moment de l'achat**, même si le client
 *  déménage ensuite. C'est aussi ce qui la rend indépendante des suppressions.
 *
 *  **Les lignes conservent le libellé du produit.** `order_line.product_name`
 *  et `product_reference` sont copiés depuis la source, pas rejoints sur
 *  `product` : un produit supprimé du catalogue ne doit pas vider l'historique.
 *  Le lien `product_id` est posé quand il existe, sinon laissé à NULL.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text, date, money, truncate } from '../../../lib/transform.ts';
import { log, count, progress } from '../../../lib/logger.ts';

const WRITE_BATCH = 2000;
const PAGE = 5000;

interface SourceOrder {
	id_order: number;
	reference: string | null;
	id_customer: number;
	current_state: number;
	payment: string | null;
	module: string | null;
	shipping_number: string | null;
	total_paid_tax_excl: string | null;
	total_paid_tax_incl: string | null;
	total_shipping_tax_incl: string | null;
	total_discounts_tax_incl: string | null;
	invoice_date: Date | null;
	delivery_date: Date | null;
	date_add: Date | null;
	date_upd: Date | null;
	id_address_delivery: number;
	id_address_invoice: number;
}

/** Adresse figée dans la commande. */
interface AddressSnapshot {
	firstname: string | null;
	lastname: string | null;
	company: string | null;
	address1: string | null;
	address2: string | null;
	postcode: string | null;
	city: string | null;
	country: string | null;
	phone: string | null;
}

function snapshot(a: AddressSnapshot | undefined) {
	if (!a) return null;
	return {
		firstName: text(a.firstname),
		lastName: text(a.lastname),
		company: text(a.company),
		line1: text(a.address1),
		line2: text(a.address2),
		postalCode: text(a.postcode),
		city: text(a.city),
		country: text(a.country) ?? 'France',
		phone: text(a.phone)
	};
}

export const ordersTask: Task = {
	name: 'orders',
	description: 'Commandes, lignes, historique, factures et paiements',
	dependsOn: ['customers', 'order-states'],

	async run({ dryRun, limit }) {
		const sql = targetDb();

		// --- Correspondances cible ---
		const custRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM customer WHERE legacy_ps_id IS NOT NULL`;
		const custByLegacy = new Map(custRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

		const stateRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM order_state WHERE legacy_ps_id IS NOT NULL`;
		const stateByLegacy = new Map(stateRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

		const [fallbackState] = await sql<{ id: number }[]>`
			SELECT id FROM order_state ORDER BY position LIMIT 1`;

		if (custByLegacy.size === 0) {
			throw new Error('Aucun client en cible : jouer « customers » avant « orders ».');
		}
		if (stateByLegacy.size === 0) {
			throw new Error('Aucun statut en cible : jouer « order-states » avant « orders ».');
		}
		log.muted(
			`${count(custByLegacy.size)} clients et ${count(stateByLegacy.size)} statuts résolus`
		);

		const prodRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM product WHERE legacy_ps_id IS NOT NULL`;
		const prodByLegacy = new Map(prodRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));
		log.muted(`${count(prodByLegacy.size)} produits résolus (lien facultatif)`);

		// --- Idempotence ---
		const existing = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM "order" WHERE legacy_ps_id IS NOT NULL`;
		const already = new Set(existing.map((r) => Number(r.legacy_ps_id)));
		if (already.size > 0) log.muted(`${count(already.size)} commandes déjà importées — ignorées`);

		// --- Adresses source, pour le figement ---
		const addrRows = await sourceQuery<AddressSnapshot & { id_address: number }>(
			`SELECT a.id_address, a.firstname, a.lastname, a.company, a.address1, a.address2,
			        a.postcode, a.city, a.phone, cl.name AS country
			   FROM ps_address a
			   LEFT JOIN ps_country_lang cl ON cl.id_country = a.id_country AND cl.id_lang = 1`
		);
		const addrById = new Map(addrRows.map((a) => [Number(a.id_address), a]));
		log.muted(`${count(addrById.size)} adresses source chargées`);

		const orders = await sourceQuery<SourceOrder>(
			`SELECT id_order, reference, id_customer, current_state, payment, module,
			        shipping_number, total_paid_tax_excl, total_paid_tax_incl,
			        total_shipping_tax_incl, total_discounts_tax_incl,
			        invoice_date, delivery_date, date_add, date_upd,
			        id_address_delivery, id_address_invoice
			   FROM ps_orders ORDER BY id_order ${limit ? `LIMIT ${limit}` : ''}`
		);
		log.muted(`${count(orders.length)} commandes en source`);

		const toCreate = orders.filter((o) => !already.has(Number(o.id_order)));
		let skippedNoCustomer = 0;

		if (dryRun) {
			log.warn(`Simulation : ${count(toCreate.length)} commandes auraient été importées.`);
			for (const o of toCreate.slice(0, 5)) {
				log.muted(
					`  ${o.reference} — ${money(o.total_paid_tax_incl, '0')} € — client ${o.id_customer}`
				);
			}
			return { processed: 0, note: 'simulation' };
		}

		// --- Commandes ---
		const orderIdByLegacy = new Map<number, number>();
		const bar = progress('commandes', toCreate.length);
		let created = 0;

		for (let i = 0; i < toCreate.length; i += WRITE_BATCH) {
			const slice = toCreate.slice(i, i + WRITE_BATCH);
			const batch = slice
				.map((o) => {
					const customerId = custByLegacy.get(Number(o.id_customer));
					// 5 commandes source pointent un client inexistant : on les écarte
					// plutôt que d'inventer un rattachement.
					if (customerId === undefined) {
						skippedNoCustomer++;
						return null;
					}
					const ttc = Number(money(o.total_paid_tax_incl, '0'));
					const ht = Number(money(o.total_paid_tax_excl, '0'));
					return {
						reference: text(o.reference) ?? `PS-${o.id_order}`,
						customer_id: customerId,
						state_id: stateByLegacy.get(Number(o.current_state)) ?? Number(fallbackState.id),
						total_ht: String(ht),
						total_tva: String(Math.max(0, ttc - ht)),
						total_ttc: String(ttc),
						shipping_fee: money(o.total_shipping_tax_incl, '0'),
						discount_amount: money(o.total_discounts_tax_incl, '0'),
						shipping_address: snapshot(addrById.get(Number(o.id_address_delivery))),
						billing_address: snapshot(addrById.get(Number(o.id_address_invoice))),
						tracking_number: text(o.shipping_number),
						payment_provider: text(o.module) ?? text(o.payment),
						paid_at: o.invoice_date ? date(o.invoice_date) : null,
						delivered_at: o.delivery_date ? date(o.delivery_date) : null,
						legacy_ps_id: Number(o.id_order),
						created_at: date(o.date_add),
						updated_at: date(o.date_upd)
					};
				})
				.filter((r): r is NonNullable<typeof r> => r !== null);

			if (batch.length > 0) {
				const inserted = await sql<{ id: number; legacy_ps_id: number }[]>`
					INSERT INTO "order" ${sql(batch)} RETURNING id, legacy_ps_id`;
				for (const r of inserted) orderIdByLegacy.set(Number(r.legacy_ps_id), Number(r.id));
				created += inserted.length;
			}
			bar.tick(created);
		}
		bar.done(created);
		log.info(`${count(created)} commandes créées.`);
		if (skippedNoCustomer > 0) {
			log.warn(`${count(skippedNoCustomer)} commandes écartées — client source inexistant.`);
		}

		// Correspondance complète, pour qu'une reprise rattache aussi les
		// dépendances des commandes créées lors d'une exécution précédente.
		const allOrders = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM "order" WHERE legacy_ps_id IS NOT NULL`;
		const orderByLegacy = new Map(allOrders.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

		// --- Lignes de commande ---
		const doneLines = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM order_line WHERE legacy_ps_id IS NOT NULL`;
		const lineDone = new Set(doneLines.map((r) => Number(r.legacy_ps_id)));

		let lines = 0;
		let lastLine = 0;
		const lbar = progress('lignes', 0);
		for (;;) {
			const page = await sourceQuery<Record<string, unknown>>(
				`SELECT id_order_detail, id_order, product_id, product_name, product_reference,
				        product_quantity, unit_price_tax_excl, unit_price_tax_incl,
				        total_price_tax_excl, total_price_tax_incl
				   FROM ps_order_detail
				  WHERE id_order_detail > ${lastLine}
				  ORDER BY id_order_detail LIMIT ${PAGE}`
			);
			if (page.length === 0) break;
			lastLine = Number(page[page.length - 1].id_order_detail);

			const batch = page
				.filter((d) => !lineDone.has(Number(d.id_order_detail)))
				.map((d) => {
					const orderId = orderByLegacy.get(Number(d.id_order));
					if (orderId === undefined) return null;
					return {
						order_id: orderId,
						// Lien facultatif : un produit disparu ne vide pas la ligne.
						product_id: prodByLegacy.get(Number(d.product_id)) ?? null,
						product_name: text(d.product_name) ?? 'Produit',
						product_reference: text(d.product_reference),
						unit_price_ht: money(d.unit_price_tax_excl, '0'),
						unit_price_ttc: money(d.unit_price_tax_incl, '0'),
						quantity: Number(d.product_quantity) || 1,
						total_ht: money(d.total_price_tax_excl, '0'),
						total_ttc: money(d.total_price_tax_incl, '0'),
						legacy_ps_id: Number(d.id_order_detail)
					};
				})
				.filter((r): r is NonNullable<typeof r> => r !== null);

			for (let i = 0; i < batch.length; i += WRITE_BATCH) {
				await sql`INSERT INTO order_line ${sql(batch.slice(i, i + WRITE_BATCH))}`;
			}
			lines += batch.length;
			lbar.tick(lines);
		}
		lbar.done(lines);
		log.info(`${count(lines)} lignes de commande créées.`);

		// --- Historique des statuts ---
		// 149 597 lignes : c'est le parcours réel de chaque commande.
		const history = await sourceQuery<Record<string, unknown>>(
			`SELECT id_order, id_order_state, date_add FROM ps_order_history ORDER BY id_order_history`
		);
		const [{ n: histCount }] = await sql<{ n: number }[]>`
			SELECT COUNT(*)::int AS n FROM order_state_history`;

		let hist = 0;
		if (Number(histCount) === 0) {
			const batch = history
				.map((h) => {
					const orderId = orderByLegacy.get(Number(h.id_order));
					const stateId = stateByLegacy.get(Number(h.id_order_state));
					if (orderId === undefined || stateId === undefined) return null;
					return {
						order_id: orderId,
						state_id: stateId,
						note: 'Importé de PrestaShop',
						created_at: date(h.date_add)
					};
				})
				.filter((r): r is NonNullable<typeof r> => r !== null);

			for (let i = 0; i < batch.length; i += WRITE_BATCH) {
				await sql`INSERT INTO order_state_history ${sql(batch.slice(i, i + WRITE_BATCH))}`;
			}
			hist = batch.length;
			log.info(`${count(hist)} entrées d'historique créées.`);
		} else {
			log.muted(
				`${count(Number(histCount))} entrées d'historique déjà présentes — import ignoré ` +
					'(vider order_state_history pour le rejouer)'
			);
		}

		// --- Factures ---
		const doneInv = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM order_invoice WHERE legacy_ps_id IS NOT NULL`;
		const invDone = new Set(doneInv.map((r) => Number(r.legacy_ps_id)));

		const invoices = await sourceQuery<Record<string, unknown>>(
			`SELECT id_order_invoice, id_order, number, delivery_number, delivery_date,
			        total_paid_tax_excl, total_paid_tax_incl, total_shipping_tax_excl,
			        total_shipping_tax_incl, total_discount_tax_excl, total_discount_tax_incl,
			        shop_address, note, date_add
			   FROM ps_order_invoice`
		);
		const invBatch = invoices
			.filter((v) => !invDone.has(Number(v.id_order_invoice)))
			.map((v) => {
				const orderId = orderByLegacy.get(Number(v.id_order));
				if (orderId === undefined) return null;
				return {
					order_id: orderId,
					// Numéro émis à l'époque : jamais recalculé.
					number: text(v.number) ?? String(v.id_order_invoice),
					delivery_number: text(v.delivery_number),
					delivery_date: v.delivery_date ? date(v.delivery_date) : null,
					total_ht: money(v.total_paid_tax_excl, '0'),
					total_ttc: money(v.total_paid_tax_incl, '0'),
					shipping_ht: money(v.total_shipping_tax_excl, '0'),
					shipping_ttc: money(v.total_shipping_tax_incl, '0'),
					discount_ht: money(v.total_discount_tax_excl, '0'),
					discount_ttc: money(v.total_discount_tax_incl, '0'),
					shop_address: text(v.shop_address),
					note: text(v.note),
					legacy_ps_id: Number(v.id_order_invoice),
					created_at: date(v.date_add)
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		for (let i = 0; i < invBatch.length; i += WRITE_BATCH) {
			await sql`INSERT INTO order_invoice ${sql(invBatch.slice(i, i + WRITE_BATCH))}`;
		}
		log.info(`${count(invBatch.length)} factures créées.`);

		// --- Paiements ---
		// `ps_order_payment` se rattache par `order_reference`, pas par id.
		const donePay = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM order_payment WHERE legacy_ps_id IS NOT NULL`;
		const payDone = new Set(donePay.map((r) => Number(r.legacy_ps_id)));

		const refRows = await sql<{ id: number; reference: string }[]>`
			SELECT id, reference FROM "order"`;
		const orderByRef = new Map(refRows.map((r) => [r.reference, Number(r.id)]));

		const payments = await sourceQuery<Record<string, unknown>>(
			`SELECT id_order_payment, order_reference, amount, payment_method,
			        transaction_id, date_add
			   FROM ps_order_payment`
		);
		const payBatch = payments
			.filter((p) => !payDone.has(Number(p.id_order_payment)))
			.map((p) => {
				const orderId = orderByRef.get(String(p.order_reference ?? ''));
				if (orderId === undefined) return null;
				return {
					order_id: orderId,
					amount: money(p.amount, '0'),
					method: text(p.payment_method),
					// Données de carte volontairement non reprises (voir le schéma).
					transaction_id: truncate(p.transaction_id, 255),
					currency: 'EUR',
					legacy_ps_id: Number(p.id_order_payment),
					created_at: date(p.date_add)
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		for (let i = 0; i < payBatch.length; i += WRITE_BATCH) {
			await sql`INSERT INTO order_payment ${sql(payBatch.slice(i, i + WRITE_BATCH))}`;
		}
		log.success(
			`${count(created)} commandes, ${count(lines)} lignes, ${count(hist)} historiques, ` +
				`${count(invBatch.length)} factures, ${count(payBatch.length)} paiements.`
		);

		return {
			processed: created,
			note: `${count(lines)} lignes, ${count(invBatch.length)} factures, ${count(payBatch.length)} paiements`
		};
	}
};

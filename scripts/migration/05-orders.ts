/**
 * Migration des commandes + lignes de commande (source.orders / order_items).
 *
 * Mappings :
 *  - customer_id : orders.client_id → customer.legacy_ps_id, avec repli sur
 *    l'email quand le client a été écarté par l'anti-collision de 03-customers.
 *  - state_id    : orders.status_id → order_status.ps_id → code cible unifié.
 *    Les drapeaux source (is_paid/is_final…) sont incohérents entre les états
 *    legacy et les ps_* : on mappe donc sur le code cible, qui porte la
 *    sémantique de référence (voir ORDER_STATE_SEED).
 *  - product_id  : order_items.product_id → product.legacy_ps_id (null si absent,
 *    la ligne reste valide grâce au snapshot nom/référence/prix).
 *  - adresses    : texte libre en source → jsonb { raw } (snapshot historique,
 *    on ne parse pas : 27k adresses libres = erreurs garanties pour rien).
 *
 * Un historique d'état initial est créé par commande (order_state_history).
 *
 * legacy_ps_id (order) = orders.id source ; idempotent, relançable.
 * Limite : passer un nombre en argument pour un échantillon.
 */
import { source, target, money, progress, closeAll } from './_shared';

const LIMIT = process.argv[2] ? Number(process.argv[2]) : null;
const BATCH = 500;

// ---------------------------------------------------------------------------
// 1. Mapping des états : ps_id source → code cible
// ---------------------------------------------------------------------------

/** ps_id PrestaShop → code de l'état unifié. */
const PS_ID_TO_CODE: Record<number, string> = {
	1: 'awaiting_payment', // En attente du paiement par chèque
	2: 'payment_accepted',
	3: 'preparing',
	4: 'shipping',
	5: 'delivered',
	6: 'cancelled',
	7: 'refunded',
	8: 'payment_error',
	9: 'validation',
	10: 'awaiting_payment', // Virement bancaire
	12: 'refunded',
	15: 'pending',
	20: 'refunded_voucher',
	22: 'cancelled',
	23: 'payment_accepted',
	24: 'awaiting_payment', // En attente de votre règlement CB
	26: 'supplier_order',
	27: 'partial_prep',
	30: 'validation', // Commande validée - expédition suivant délai
	31: 'awaiting_payment', // Règlement via CHORUS PRO
	32: 'shipping', // En cours de livraison CHORUS
	33: 'validation', // Commande prête en attente de la deuxième
	35: 'preparing',
	36: 'preparing',
	37: 'shipping',
	38: 'delivered',
	39: 'cancelled',
	40: 'refunded',
	41: 'delivery_dispute',
	42: 'delivery_dispute',
	43: 'delivery_dispute'
};

/** États legacy (sans ps_id) : name source → code cible. */
const LEGACY_NAME_TO_CODE: Record<string, string> = {
	pending: 'pending',
	en_attente_du_paiement_par_cheque: 'awaiting_payment',
	en_attente_du_paiement_par_virement_bancaire: 'awaiting_payment',
	en_attente_de_votre_reglement_cb: 'awaiting_payment',
	en_attente_virement: 'awaiting_payment',
	paiement_accepte: 'payment_accepted',
	paiement_a_distance_accepte: 'payment_accepted',
	paiement_virement_accepte: 'payment_accepted',
	reglement_via_chorus_pro: 'awaiting_payment',
	erreur_de_paiement: 'payment_error',
	en_cours_de_validation_par_notre_equipe: 'validation',
	en_cours_de_traitement: 'validation',
	en_attente_de_votre_reponse_par_mail: 'validation',
	validee: 'validation',
	commande_validee_expedition_suivant_delai_indique_s_produit: 'validation',
	commande_prete_en_attente_de_la_deuxieme: 'validation',
	preparation_en_cours: 'preparing',
	prepa_en_cour_partiel_en_attente_de_certaines_references: 'partial_prep',
	en_cours_de_livraison_partiel: 'partial_prep',
	commande_placee_chez_le_fournisseur: 'supplier_order',
	commandee_fournisseur: 'supplier_order',
	en_cours_de_livraison: 'shipping',
	en_cour_de_livraison_chorus: 'shipping',
	livraison_chorus: 'shipping',
	livraison_standard: 'shipping',
	livre: 'delivered',
	livree: 'delivered',
	litige_de_livraison_reclamation_fait_au_transporteur: 'delivery_dispute',
	annule: 'cancelled',
	rembourse: 'refunded',
	remboursee: 'refunded',
	rembourser_par_avoir_sous_forme_d_un_code: 'refunded_voucher',
	remboursee_avoir: 'refunded_voucher'
};

/** Repli ultime si un état échappe aux deux tables ci-dessus. */
const FALLBACK_CODE = 'pending';

const targetStates = await target`SELECT id, code FROM order_state`;
const stateIdByCode = new Map<string, number>(
	targetStates.map((r) => [r.code as string, Number(r.id)])
);
for (const code of new Set([
	...Object.values(PS_ID_TO_CODE),
	...Object.values(LEGACY_NAME_TO_CODE),
	FALLBACK_CODE
])) {
	if (!stateIdByCode.has(code))
		throw new Error(`État cible « ${code} » absent : lancer d'abord scripts/seed-order-states.ts`);
}

// status_id source → state_id cible
const srcStatuses = await source`SELECT id, name, ps_id FROM order_status`;
const stateIdBySrcId = new Map<number, number>();
const unmapped: string[] = [];
for (const s of srcStatuses) {
	const psId = s.ps_id != null ? Number(s.ps_id) : null;
	const code =
		(psId != null ? PS_ID_TO_CODE[psId] : undefined) ?? LEGACY_NAME_TO_CODE[String(s.name)] ?? null;
	if (!code) unmapped.push(`${s.id}:${s.name}`);
	stateIdBySrcId.set(Number(s.id), stateIdByCode.get(code ?? FALLBACK_CODE)!);
}
if (unmapped.length)
	console.log(`  ⚠ états sans mapping (→ ${FALLBACK_CODE}) : ${unmapped.join(', ')}`);

// ---------------------------------------------------------------------------
// 2. Mapping des clients (legacy_ps_id, avec repli par email)
// ---------------------------------------------------------------------------

const custRows = await target`SELECT id, legacy_ps_id, email FROM customer`;
const custByLegacy = new Map<number, number>(
	custRows.filter((r) => r.legacy_ps_id != null).map((r) => [Number(r.legacy_ps_id), Number(r.id)])
);
const custByEmail = new Map<string, number>(
	custRows.filter((r) => r.email).map((r) => [String(r.email).toLowerCase(), Number(r.id)])
);

// Clients référencés par des commandes mais absents du mapping direct :
// ils ont été écartés par l'anti-collision d'email de 03-customers.ts.
// On les rattache au customer cible portant le même email.
const orphanClients = await source`
	SELECT DISTINCT c.id, c.email
	FROM orders o JOIN clients c ON c.id = o.client_id`;
let recovered = 0;
for (const c of orphanClients) {
	const legacyId = Number(c.id);
	if (custByLegacy.has(legacyId)) continue;
	const byEmail = c.email ? custByEmail.get(String(c.email).toLowerCase()) : undefined;
	if (byEmail) {
		custByLegacy.set(legacyId, byEmail);
		recovered++;
	}
}
if (recovered) console.log(`  ↳ ${recovered} client(s) rattaché(s) par email (doublons source)`);

// ---------------------------------------------------------------------------
// 3. Mapping des produits
// ---------------------------------------------------------------------------

const prodRows = await target`SELECT id, legacy_ps_id FROM product WHERE legacy_ps_id IS NOT NULL`;
const prodByLegacy = new Map<number, number>(
	prodRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)])
);

// ---------------------------------------------------------------------------
// 4. Commandes déjà importées (idempotence) + références déjà prises
// ---------------------------------------------------------------------------

const existingOrders = await target`SELECT legacy_ps_id, reference FROM "order"`;
const alreadyImported = new Set<number>(
	existingOrders.filter((r) => r.legacy_ps_id != null).map((r) => Number(r.legacy_ps_id))
);
const usedRefs = new Set<string>(existingOrders.map((r) => r.reference as string));

const [{ total }] = await source`SELECT COUNT(*)::int AS total FROM orders`;
const totalToProcess = LIMIT ?? Number(total);
console.log(`Commandes source : ${total}${LIMIT ? ` (échantillon: ${LIMIT})` : ''}`);

/** Adresse texte libre → snapshot jsonb (pas de parsing hasardeux). */
function addressSnapshot(raw: unknown): { raw: string } | null {
	const s = typeof raw === 'string' ? raw.trim() : '';
	return s ? { raw: s } : null;
}

const p = progress('orders');
let processed = 0;
let inserted = 0;
let linesInserted = 0;
let skippedNoCustomer = 0;
let offset = 0;

while (offset < totalToProcess) {
	const take = Math.min(BATCH, totalToProcess - offset);
	const rows = await source`
		SELECT id, client_id, status_id, reference, total_ht, total_ttc, total_tva,
		       frais_port, discount_amount, adresse_livraison, adresse_facturation,
		       carrier_id, tracking_number, tracking_url, package_weight_kg,
		       payment_provider, payment_reference, payment_captured_at,
		       note_facture, private_note,
		       date_commande, date_livraison, date_ajout
		FROM orders
		ORDER BY id
		LIMIT ${take} OFFSET ${offset}`;

	if (rows.length === 0) break;

	const orderRows: Record<string, unknown>[] = [];
	const legacyIdsInBatch: number[] = [];

	for (const r of rows) {
		if (alreadyImported.has(Number(r.id))) continue;

		const customerId = custByLegacy.get(Number(r.client_id));
		if (!customerId) {
			// order.customer_id est NOT NULL / ON DELETE RESTRICT : sans client, on saute.
			skippedNoCustomer++;
			continue;
		}

		const stateId = stateIdBySrcId.get(Number(r.status_id)) ?? stateIdByCode.get(FALLBACK_CODE)!;

		// La référence est unique en cible : on désambiguïse si collision.
		let reference = String(r.reference || `CMD-${r.id}`);
		if (usedRefs.has(reference)) reference = `${reference}-${r.id}`;
		usedRefs.add(reference);

		const createdAt = r.date_commande || r.date_ajout || new Date();

		orderRows.push({
			reference,
			customer_id: customerId,
			state_id: stateId,
			total_ht: money(r.total_ht),
			total_tva: money(r.total_tva),
			total_ttc: money(r.total_ttc),
			shipping_fee: money(r.frais_port),
			discount_amount: money(r.discount_amount),
			shipping_address: addressSnapshot(r.adresse_livraison),
			billing_address: addressSnapshot(r.adresse_facturation),
			carrier_id: r.carrier_id != null ? Number(r.carrier_id) : null,
			tracking_number: r.tracking_number || null,
			tracking_url: r.tracking_url || null,
			package_weight_kg: r.package_weight_kg != null ? money(r.package_weight_kg) : null,
			payment_provider: r.payment_provider || null,
			payment_reference: r.payment_reference || null,
			paid_at: r.payment_captured_at || null,
			invoice_note: r.note_facture || null,
			private_note: r.private_note || null,
			legacy_ps_id: Number(r.id),
			created_at: createdAt,
			updated_at: createdAt,
			delivered_at: r.date_livraison || null
		});
		legacyIdsInBatch.push(Number(r.id));
	}

	if (orderRows.length > 0) {
		// jsonb : postgres.js sérialise mal les objets nus dans un INSERT bulk.
		for (const o of orderRows) {
			o.shipping_address = o.shipping_address ? JSON.stringify(o.shipping_address) : null;
			o.billing_address = o.billing_address ? JSON.stringify(o.billing_address) : null;
		}

		await target`INSERT INTO "order" ${target(orderRows)}`;
		inserted += orderRows.length;

		// --- Lignes de commande, remappées via les legacy_ps_id fraîchement insérés ---
		const newOrders = await target`
			SELECT id, legacy_ps_id, state_id FROM "order" WHERE legacy_ps_id = ANY(${legacyIdsInBatch})`;
		const orderByLegacy = new Map<number, { id: number; stateId: number }>(
			newOrders.map((r) => [
				Number(r.legacy_ps_id),
				{ id: Number(r.id), stateId: Number(r.state_id) }
			])
		);

		const items = await source`
			SELECT order_id, product_id, product_name, product_reference, product_image_url,
			       prix_unitaire_ht, prix_unitaire_ttc, quantite, total_ht, total_ttc,
			       date_ajout, id
			FROM order_items
			WHERE order_id = ANY(${legacyIdsInBatch})
			ORDER BY id`;

		const lineRows = items
			.map((it) => {
				const o = orderByLegacy.get(Number(it.order_id));
				if (!o) return null;
				const productId =
					it.product_id != null ? (prodByLegacy.get(Number(it.product_id)) ?? null) : null;
				return {
					order_id: o.id,
					product_id: productId,
					variant_id: null,
					product_name: it.product_name || 'Produit',
					product_reference: it.product_reference || null,
					product_image_url: it.product_image_url || null,
					unit_price_ht: money(it.prix_unitaire_ht),
					unit_price_ttc: money(it.prix_unitaire_ttc),
					quantity: Number(it.quantite) || 1,
					total_ht: money(it.total_ht),
					total_ttc: money(it.total_ttc),
					legacy_ps_id: Number(it.id),
					created_at: it.date_ajout || new Date()
				} as Record<string, unknown>;
			})
			.filter((x): x is Record<string, unknown> => x !== null);

		for (let i = 0; i < lineRows.length; i += 1000) {
			const chunk = lineRows.slice(i, i + 1000);
			if (chunk.length) await target`INSERT INTO order_line ${target(chunk)}`;
		}
		linesInserted += lineRows.length;

		// --- Historique : un enregistrement initial par commande ---
		const historyRows = orderRows.map((o) => {
			const entry = orderByLegacy.get(Number(o.legacy_ps_id))!;
			return {
				order_id: entry.id,
				state_id: entry.stateId,
				changed_by: null,
				note: 'Import depuis l’ancienne boutique',
				created_at: o.created_at
			} as Record<string, unknown>;
		});
		for (let i = 0; i < historyRows.length; i += 1000) {
			const chunk = historyRows.slice(i, i + 1000);
			if (chunk.length) await target`INSERT INTO order_state_history ${target(chunk)}`;
		}
	}

	processed += rows.length;
	offset += take;
	p.tick(processed, totalToProcess);
}

p.done(inserted);
console.log(`  lignes de commande : ${linesInserted}`);
console.log(`  (${processed - inserted - skippedNoCustomer} déjà importées/ignorées)`);
if (skippedNoCustomer)
	console.log(`  ⚠ ${skippedNoCustomer} commande(s) sautée(s) : client introuvable`);
await closeAll();

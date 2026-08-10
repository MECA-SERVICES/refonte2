/**
 * Import des clients et de leurs adresses : `ps_customer` + `ps_address`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Pourquoi cette tâche existe
 *
 *  Les clients présents en base viennent de la chaîne `prod5 → metro → sakura`,
 *  qui a perdu des données à chaque saut. Mesuré le 2026-08-10 :
 *
 *      clients   25 485 en source  →  24 480 en base   (1 005 manquants)
 *      adresses  38 445 en source  →  23 867 en base  (14 578 manquants, 38 %)
 *
 *  Cette tâche repart de la source, en direct, comme pour le catalogue.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Deux contraintes du schéma cible ───────────────────────────────────────
 *
 *  1. `customer.user_id` est NOT NULL : chaque client exige un compte `user`
 *     (better-auth). On le crée donc en même temps, avec un id déterministe
 *     dérivé de l'`id_customer` source — ce qui rend la tâche rejouable.
 *
 *  2. `user.email` est unique, or la source contient **47 doublons**
 *     (`mickael-40@live.fr` ×3…). Le premier client gagne l'email ; les
 *     suivants reçoivent un email suffixé, traçable et non ambigu. Les écarter
 *     ferait perdre leurs commandes.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text, date, bool, truncate } from '../../../lib/transform.ts';
import { log, count, progress } from '../../../lib/logger.ts';

const WRITE_BATCH = 2000;

interface SourceCustomer {
	id_customer: number;
	firstname: string | null;
	lastname: string | null;
	email: string | null;
	company: string | null;
	siret: string | null;
	newsletter: number;
	note: string | null;
	active: number;
	is_guest: number;
	deleted: number;
	date_add: Date | null;
	date_upd: Date | null;
}

interface SourceAddress {
	id_address: number;
	id_customer: number;
	alias: string | null;
	company: string | null;
	firstname: string | null;
	lastname: string | null;
	address1: string | null;
	address2: string | null;
	postcode: string | null;
	city: string | null;
	phone: string | null;
	phone_mobile: string | null;
	vat_number: string | null;
	country: string | null;
	deleted: number;
	date_add: Date | null;
	date_upd: Date | null;
}

/** Identifiant `user` déterministe : rejouable sans créer de doublon. */
function userIdFor(legacyCustomerId: number): string {
	return `ps-${legacyCustomerId}`;
}

export const customersTask: Task = {
	name: 'customers',
	description: 'Clients et adresses (ps_customer + ps_address)',

	async run({ dryRun, limit }) {
		const sql = targetDb();

		const rows = await sourceQuery<SourceCustomer>(
			`SELECT id_customer, firstname, lastname, email, company, siret,
			        newsletter, note, active, is_guest, deleted, date_add, date_upd
			   FROM ps_customer
			  ORDER BY id_customer
			  ${limit ? `LIMIT ${limit}` : ''}`
		);
		log.muted(`${count(rows.length)} clients en source`);

		// --- Idempotence ---
		const existing = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM customer WHERE legacy_ps_id IS NOT NULL`;
		const already = new Set(existing.map((r) => Number(r.legacy_ps_id)));
		if (already.size > 0) log.muted(`${count(already.size)} clients déjà importés — ignorés`);

		// --- Déduplication des emails ---
		// `user.email` est unique. On réserve d'abord les emails déjà pris en
		// cible, puis on suffixe les doublons source plutôt que de les perdre.
		const usedRows = await sql<{ email: string }[]>`SELECT email FROM "user"`;
		const usedEmails = new Set(usedRows.map((r) => r.email.toLowerCase()));

		let deduped = 0;
		const toCreate: { c: SourceCustomer; email: string; userId: string }[] = [];

		for (const c of rows) {
			const legacyId = Number(c.id_customer);
			if (already.has(legacyId)) continue;

			const base = (text(c.email) ?? `client-${legacyId}@import.local`).toLowerCase();
			let email = base;
			if (usedEmails.has(email)) {
				// Suffixe traçable : on retrouve toujours le client d'origine.
				const [local, domain] = base.split('@');
				email = `${local}+ps${legacyId}@${domain ?? 'import.local'}`;
				deduped++;
			}
			usedEmails.add(email);
			toCreate.push({ c, email, userId: userIdFor(legacyId) });
		}

		if (deduped > 0) {
			log.warn(`${count(deduped)} emails en doublon — suffixés (+psID) pour rester importables`);
		}

		// --- Adresses ---
		const addresses = await sourceQuery<SourceAddress>(
			`SELECT a.id_address, a.id_customer, a.alias, a.company, a.firstname, a.lastname,
			        a.address1, a.address2, a.postcode, a.city, a.phone, a.phone_mobile,
			        a.vat_number, a.deleted, a.date_add, a.date_upd,
			        cl.name AS country
			   FROM ps_address a
			   LEFT JOIN ps_country_lang cl
			          ON cl.id_country = a.id_country AND cl.id_lang = 1
			  WHERE a.id_customer > 0
			  ORDER BY a.id_address`
		);
		log.muted(`${count(addresses.length)} adresses en source`);

		if (dryRun) {
			log.warn(
				`Simulation : ${count(toCreate.length)} clients et ${count(addresses.length)} adresses.`
			);
			for (const { c, email } of toCreate.slice(0, 5)) {
				log.muted(`  ${text(c.lastname) ?? ''} ${text(c.firstname) ?? ''} — ${email}`);
			}
			return { processed: 0, note: 'simulation' };
		}

		// --- Écriture : user → customer → address, dans l'ordre des FK ---
		const bar = progress('clients', toCreate.length);
		let created = 0;
		const customerIdByLegacy = new Map<number, number>();

		for (let i = 0; i < toCreate.length; i += WRITE_BATCH) {
			const slice = toCreate.slice(i, i + WRITE_BATCH);

			await sql.begin(async (tx) => {
				// 1. Comptes `user` (better-auth). `is_guest` reste un compte : la
				//    commande doit rester rattachée à quelqu'un.
				await tx`INSERT INTO "user" ${tx(
					slice.map(({ c, email, userId }) => ({
						id: userId,
						name: `${text(c.firstname) ?? ''} ${text(c.lastname) ?? ''}`.trim() || email,
						email,
						email_verified: false,
						created_at: date(c.date_add),
						updated_at: date(c.date_upd)
					}))
				)} ON CONFLICT (id) DO NOTHING`;

				// 2. Fiches `customer`
				const inserted = await tx<{ id: number; legacy_ps_id: number }[]>`
					INSERT INTO customer ${tx(
						slice.map(({ c, email, userId }) => ({
							user_id: userId,
							first_name: text(c.firstname) ?? '',
							last_name: text(c.lastname) ?? '',
							email,
							// `company` renseigné ⇒ client professionnel.
							type: text(c.company) ? 'professional' : 'individual',
							// Un client supprimé à la source reste importé mais inactif :
							// ses commandes doivent rester consultables.
							status: bool(c.deleted) || !bool(c.active) ? 'inactive' : 'active',
							company_name: text(c.company),
							siret: truncate(c.siret, 14),
							private_note: text(c.note),
							newsletter_subscribed: bool(c.newsletter),
							source: 'prestashop',
							legacy_ps_id: Number(c.id_customer),
							created_at: date(c.date_add),
							updated_at: date(c.date_upd)
						}))
					)}
					RETURNING id, legacy_ps_id`;

				for (const r of inserted) customerIdByLegacy.set(Number(r.legacy_ps_id), Number(r.id));
			});

			created += slice.length;
			bar.tick(created);
		}
		bar.done(created);
		log.info(`${count(created)} clients créés.`);

		// --- Adresses, une fois les clients en place ---
		// On recharge la correspondance complète : un import repris doit pouvoir
		// rattacher des adresses à des clients créés lors d'une exécution passée.
		const allCustomers = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM customer WHERE legacy_ps_id IS NOT NULL`;
		const custByLegacy = new Map(allCustomers.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));

		const existingAddr = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM address WHERE legacy_ps_id IS NOT NULL`;
		const addrDone = new Set(existingAddr.map((r) => Number(r.legacy_ps_id)));

		const addrRows = addresses
			.filter((a) => !addrDone.has(Number(a.id_address)))
			.map((a) => {
				const customerId = custByLegacy.get(Number(a.id_customer));
				if (customerId === undefined) return null;
				return {
					customer_id: customerId,
					label: text(a.alias),
					first_name: text(a.firstname) ?? '',
					last_name: text(a.lastname) ?? '',
					company: text(a.company),
					line1: text(a.address1) ?? '',
					line2: text(a.address2),
					city: text(a.city) ?? '',
					postal_code: text(a.postcode) ?? '',
					country: text(a.country) ?? 'France',
					phone: text(a.phone) ?? text(a.phone_mobile),
					is_default_shipping: false,
					is_default_billing: false,
					legacy_ps_id: Number(a.id_address),
					created_at: date(a.date_add),
					updated_at: date(a.date_upd)
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		const orphanAddr = addresses.length - addrDone.size - addrRows.length;

		let addrCreated = 0;
		const abar = progress('adresses', addrRows.length);
		for (let i = 0; i < addrRows.length; i += WRITE_BATCH) {
			await sql`INSERT INTO address ${sql(addrRows.slice(i, i + WRITE_BATCH))}`;
			addrCreated += Math.min(WRITE_BATCH, addrRows.length - i);
			abar.tick(addrCreated);
		}
		abar.done(addrCreated);

		log.success(`${count(created)} clients et ${count(addrCreated)} adresses importés.`);
		if (orphanAddr > 0) {
			log.warn(`${count(orphanAddr)} adresses sans client correspondant — non importées.`);
		}

		return {
			processed: created,
			note: `${count(addrCreated)} adresses, ${count(deduped)} emails dédupliqués`
		};
	}
};

/**
 * Migration des clients + adresses.
 *
 * Chaque client source → 1 user (better-auth, role=customer) + 1 customer.
 * legacy_ps_id (customer) = clients.id source, pour relier les adresses/commandes.
 * Les adresses sont liées via client_addresses.client_id = clients.id.
 */
import { source, target, progress, closeAll } from './_shared';
import { randomUUID } from 'crypto';

// --- Clients déjà importés (idempotence) ---
const existing = await target`SELECT legacy_ps_id FROM customer WHERE legacy_ps_id IS NOT NULL`;
const alreadyImported = new Set<number>(existing.map((r) => Number(r.legacy_ps_id)));

// Emails déjà pris côté user (le compte admin, comptes existants).
const existingEmails = await target`SELECT email FROM "user"`;
const usedEmails = new Set<string>(existingEmails.map((r) => (r.email as string).toLowerCase()));

const clients = await source`
	SELECT id, prenom, nom, email, telephone, type_client, account_type, account_status,
	       company_name, siret, vat_number, total_achats, private_note,
	       newsletter_subscribed, date_creation
	FROM clients
	ORDER BY id`;

console.log(`Clients source : ${clients.length}`);

// Prépare users + customers en gardant le lien (userId ↔ legacy client id).
const now = new Date();
const userRows: Record<string, unknown>[] = [];
const customerRows: Record<string, unknown>[] = [];

const typeMap: Record<string, string> = {
	particulier: 'particulier',
	entreprise: 'entreprise',
	professionnel: 'entreprise',
	collectivite: 'collectivite'
};

for (const c of clients) {
	if (alreadyImported.has(Number(c.id))) continue;

	const email = (c.email || `client-${c.id}@import.local`).toLowerCase();
	if (usedEmails.has(email)) continue; // évite les collisions d'email
	usedEmails.add(email);

	const userId = randomUUID();
	const firstName = c.prenom || '—';
	const lastName = c.nom || '—';

	userRows.push({
		id: userId,
		name: `${firstName} ${lastName}`.trim(),
		email,
		email_verified: false,
		role: 'customer',
		created_at: c.date_creation || now,
		updated_at: now
	});

	customerRows.push({
		user_id: userId,
		first_name: firstName,
		last_name: lastName,
		email,
		phone: c.telephone || null,
		type: typeMap[c.account_type] || typeMap[c.type_client] || 'particulier',
		status: c.account_status === 'validated' ? 'validated' : 'pending',
		company_name: c.company_name || null,
		siret: c.siret || null,
		vat_number: c.vat_number || null,
		total_spent: c.total_achats != null ? String(c.total_achats) : '0',
		private_note: c.private_note || null,
		newsletter_subscribed: c.newsletter_subscribed === true,
		legacy_ps_id: Number(c.id),
		created_at: c.date_creation || now,
		updated_at: now
	});
}

// --- Insertion users puis customers (bulk 500) ---
const p1 = progress('users+customers');
let count = 0;
for (let i = 0; i < userRows.length; i += 500) {
	const uBatch = userRows.slice(i, i + 500);
	const cBatch = customerRows.slice(i, i + 500);
	if (uBatch.length) {
		await target`INSERT INTO "user" ${target(uBatch)}`;
		await target`INSERT INTO customer ${target(cBatch)}`;
	}
	count += uBatch.length;
	p1.tick(count, userRows.length);
}
p1.done(count);

// --- Adresses ---
// Mapping legacy client id → nouveau customer id.
const custMap = await target`SELECT id, legacy_ps_id FROM customer WHERE legacy_ps_id IS NOT NULL`;
const custByLegacy = new Map<number, number>(
	custMap.map((r) => [Number(r.legacy_ps_id), Number(r.id)])
);

// Adresses déjà importées (idempotence via legacy_ps_id = client_addresses.id).
const existingAddr = await target`SELECT legacy_ps_id FROM address WHERE legacy_ps_id IS NOT NULL`;
const addrImported = new Set<number>(existingAddr.map((r) => Number(r.legacy_ps_id)));

const addresses = await source`
	SELECT id, client_id, label, first_name, last_name, company,
	       address_line1, address_line2, city, postal_code, country, phone,
	       is_default_shipping, is_default_billing
	FROM client_addresses
	ORDER BY id`;

const addrRows: Record<string, unknown>[] = [];
for (const a of addresses) {
	if (addrImported.has(Number(a.id))) continue;
	const customerId = custByLegacy.get(Number(a.client_id));
	if (!customerId) continue; // client non migré (ignoré)

	addrRows.push({
		customer_id: customerId,
		label: a.label || null,
		first_name: a.first_name || '—',
		last_name: a.last_name || '—',
		company: a.company || null,
		line1: a.address_line1 || '—',
		line2: a.address_line2 || null,
		city: a.city || '—',
		postal_code: a.postal_code || '—',
		country: a.country || 'FR',
		phone: a.phone || null,
		is_default_shipping: a.is_default_shipping === true,
		is_default_billing: a.is_default_billing === true,
		legacy_ps_id: Number(a.id)
	});
}

const p2 = progress('addresses');
let aCount = 0;
for (let i = 0; i < addrRows.length; i += 500) {
	const batch = addrRows.slice(i, i + 500);
	if (batch.length) await target`INSERT INTO address ${target(batch)}`;
	aCount += batch.length;
	p2.tick(aCount, addrRows.length);
}
p2.done(aCount);

await closeAll();

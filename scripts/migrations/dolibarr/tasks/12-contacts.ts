/**
 * Contacts Dolibarr (`llx_socpeople`) → `contact` : les interlocuteurs d'un
 * tiers (service facturation, commercial, livreur…), rattachés à son
 * fournisseur MSShop s'il en est un, sinon à son client. Un contact dont le
 * tiers n'est pas repris est ignoré.
 *
 * À lancer après `customers` et `suppliers`. Idempotent par
 * `contact.legacy_doli_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { htmlText, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

interface SourceContact {
	rowid: number;
	fk_soc: number | null;
	firstname: string | null;
	lastname: string | null;
	poste: string | null;
	email: string | null;
	phone: string | null;
	phone_perso: string | null;
	phone_mobile: string | null;
	note_private: string | null;
	statut: number;
}

export const contactsTask: Task = {
	name: 'contacts',
	description: 'Contacts des tiers (llx_socpeople → contact)',

	async run({ dryRun }) {
		const contacts = await sourceQuery<SourceContact>(
			`SELECT rowid, fk_soc, firstname, lastname, poste, email, phone, phone_perso, phone_mobile,
			        note_private, statut
			 FROM ${DOLI}.llx_socpeople ORDER BY rowid`
		);
		log.muted(`${count(contacts.length)} contacts en source`);

		const sql = targetDb();
		const [suppliers, customers] = await Promise.all([
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM supplier WHERE legacy_doli_id IS NOT NULL`,
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM customer WHERE legacy_doli_id IS NOT NULL`
		]);
		const supplierOf = new Map(suppliers.map((s) => [Number(s.doli), s.id]));
		const customerOf = new Map(customers.map((c) => [Number(c.doli), c.id]));

		const rows = contacts.flatMap((c) => {
			const soc = Number(c.fk_soc);
			const supplierId = supplierOf.get(soc) ?? null;
			const customerId = supplierId ? null : (customerOf.get(soc) ?? null);
			if (!supplierId && !customerId) return [];
			const first = text(c.firstname);
			return [
				{
					legacy_doli_id: Number(c.rowid),
					supplier_id: supplierId,
					customer_id: customerId,
					first_name: first,
					// Dolibarr laisse souvent le nom vide quand il ne nomme qu'un service.
					last_name: text(c.lastname) ?? first ?? text(c.poste) ?? 'Contact',
					role: text(c.poste),
					email: text(c.email)?.toLowerCase() ?? null,
					phone: text(c.phone) ?? text(c.phone_perso),
					mobile: text(c.phone_mobile),
					note: text(htmlText(c.note_private)),
					is_active: Number(c.statut) === 1
				}
			];
		});
		const toSuppliers = rows.filter((r) => r.supplier_id).length;
		log.muted(
			`${count(toSuppliers)} chez un fournisseur, ${count(rows.length - toSuppliers)} chez un client, ${count(contacts.length - rows.length)} sans tiers repris`
		);
		if (dryRun) {
			log.warn(`Simulation : ${count(rows.length)} contacts auraient été repris.`);
			return { processed: 0, note: 'simulation' };
		}

		await sql`
			INSERT INTO contact (legacy_doli_id, supplier_id, customer_id, first_name, last_name, role,
				email, phone, mobile, note, is_active)
			SELECT legacy_doli_id, supplier_id, customer_id, first_name, last_name, role, email, phone,
				mobile, note, is_active
			FROM jsonb_to_recordset(${sql.json(rows)}) AS c(legacy_doli_id int, supplier_id int,
				customer_id int, first_name text, last_name text, role text, email text, phone text,
				mobile text, note text, is_active boolean)
			ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
				supplier_id = excluded.supplier_id, customer_id = excluded.customer_id,
				first_name = excluded.first_name, last_name = excluded.last_name, role = excluded.role,
				email = excluded.email, phone = excluded.phone, mobile = excluded.mobile,
				note = excluded.note, is_active = excluded.is_active, updated_at = now()`;
		return { processed: rows.length, note: `${count(rows.length)} contacts` };
	}
};

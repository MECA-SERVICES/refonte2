/**
 * Clients : tous les tiers Dolibarr (`llx_societe`) sauf les fournisseurs
 * seuls → `customer`. La plupart sont des clients PrestaShop recopiés par la
 * synchronisation « MAJ BDD », déjà dans MSShop ; les autres sont des clients
 * du comptoir.
 *
 * Un seul fichier client : un tiers se rattache au client MSShop de même
 * e-mail, puis de même SIRET. Sinon il est créé **sans compte web** (pas de
 * connexion à la boutique, e-mail facultatif), avec son adresse de
 * facturation. Le nom Dolibarr (« DUPONT JEAN », ou la raison sociale) est
 * repris tel quel dans le nom, et en société s'il a un SIRET ou un n° de TVA.
 *
 * Doublons Dolibarr : un tiers sans facture ni devis dont l'e-mail appartient
 * déjà à un autre client repris n'est pas créé une seconde fois. Un tiers
 * facturé, lui, l'est toujours (sans e-mail), pour garder ses factures.
 *
 * La note privée du tiers (`note_private`) devient la note interne du client,
 * son site et son fax sont repris, et son autre nom (`name_alias`) quand il
 * n'est pas déjà dans le nom du client (souvent le prénom) ; sans jamais
 * écraser une saisie MSShop.
 *
 * Idempotent par `customer.legacy_doli_id = llx_societe.rowid`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { htmlLines } from '../lines.ts';

interface SourceThirdParty {
	rowid: number;
	nom: string;
	email: string | null;
	phone: string | null;
	address: string | null;
	zip: string | null;
	town: string | null;
	siret: string | null;
	tva_intra: string | null;
	country: string | null;
	note_private: string | null;
	name_alias: string | null;
	url: string | null;
	fax: string | null;
	/** Au moins une facture ou un devis. */
	active: number;
}

export const customersTask: Task = {
	name: 'customers',
	description: 'Clients (llx_societe → customer : rattachés, sinon créés sans compte web)',

	async run({ dryRun }) {
		const rows = await sourceQuery<SourceThirdParty>(
			`SELECT s.rowid, s.nom, s.email, s.phone, s.address, s.zip, s.town, s.siret, s.tva_intra,
			        c.code AS country, s.note_private, s.name_alias, s.url, s.fax,
			        (s.rowid IN (SELECT fk_soc FROM ${DOLI}.llx_facture)
			         OR s.rowid IN (SELECT fk_soc FROM ${DOLI}.llx_propal)) AS active
			 FROM ${DOLI}.llx_societe s
			 LEFT JOIN ${DOLI}.llx_c_country c ON c.rowid = s.fk_pays
			 WHERE NOT (s.fournisseur = 1 AND s.client = 0)
			 ORDER BY active DESC, s.rowid`
		);
		log.muted(`${count(rows.length)} tiers clients en source`);

		const sql = targetDb();
		const existing = await sql<
			{ id: number; email: string | null; siret: string | null; doli: number | null }[]
		>`
			SELECT id, lower(email) AS email, siret, legacy_doli_id AS doli FROM customer`;
		const byDoli = new Map(existing.filter((c) => c.doli).map((c) => [Number(c.doli), c.id]));
		const byEmail = new Map(
			existing.filter((c) => c.email && !c.doli).map((c) => [c.email!, c.id])
		);
		const bySiret = new Map(
			existing.filter((c) => c.siret && !c.doli).map((c) => [c.siret!, c.id])
		);

		// E-mails déjà portés par un client repris : un tiers sans activité qui en
		// porte un est un doublon Dolibarr.
		const claimed = new Set(existing.filter((c) => c.email && c.doli).map((c) => c.email!));
		const links: { id: number; doli: number }[] = [];
		const creations: SourceThirdParty[] = [];
		let duplicates = 0;
		for (const r of rows) {
			if (byDoli.has(Number(r.rowid))) continue;
			const email = text(r.email)?.toLowerCase();
			const siret = text(r.siret)?.replace(/\s/g, '');
			const id = (email && byEmail.get(email)) || (siret && bySiret.get(siret));
			if (id) {
				links.push({ id, doli: Number(r.rowid) });
				if (email) byEmail.delete(email);
				if (siret) bySiret.delete(siret);
			} else if (email && claimed.has(email) && !Number(r.active)) {
				duplicates++;
				continue;
			} else creations.push(r);
			if (email) claimed.add(email);
		}
		log.muted(
			`${count(byDoli.size)} déjà repris, ${count(links.length)} rattachés (e-mail ou SIRET), ${count(creations.length)} à créer sans compte web, ${count(duplicates)} doublons Dolibarr ignorés`
		);

		const notes = rows
			.map((r) => ({ doli: Number(r.rowid), note: htmlLines(r.note_private) }))
			.filter((n) => n.note);
		log.muted(`${count(notes.length)} notes internes (sans écraser celles de MSShop)`);
		const extras = rows
			.map((r) => ({
				doli: Number(r.rowid),
				alias: text(r.name_alias),
				website: text(r.url),
				fax: text(r.fax)
			}))
			.filter((e) => e.alias || e.website || e.fax);
		log.muted(`${count(extras.length)} tiers avec un autre nom, un site ou un fax`);

		if (dryRun) {
			log.warn('Simulation : aucun client repris.');
			return { processed: 0, note: 'simulation' };
		}

		await sql.begin(async (tx) => {
			if (links.length) {
				await tx`
					UPDATE customer AS c SET legacy_doli_id = l.doli, updated_at = now()
					FROM jsonb_to_recordset(${tx.json(links)}) AS l(id int, doli int)
					WHERE c.id = l.id AND c.legacy_doli_id IS NULL`;
			}
			// Un e-mail déjà porté par un client ne se duplique pas : la fiche
			// Dolibarr est alors créée sans e-mail.
			const taken = new Set(existing.map((c) => c.email).filter(Boolean));
			for (const r of creations) {
				const name = r.nom.replace(/\s+/g, ' ').trim() || `Client Dolibarr ${r.rowid}`;
				const email = text(r.email)?.toLowerCase() ?? null;
				const isCompany = Boolean(text(r.siret) || text(r.tva_intra));
				const [created] = await tx<{ id: number }[]>`
					INSERT INTO customer (user_id, first_name, last_name, email, phone, type, status,
						company_name, siret, vat_number, billing_country, source, legacy_doli_id)
					VALUES (NULL, '', ${name}, ${email && !taken.has(email) ? email : null}, ${text(r.phone)},
						${isCompany ? 'pro' : 'particulier'}, 'validated', ${isCompany ? name : null},
						${text(r.siret)?.replace(/\s/g, '').slice(0, 14) ?? null}, ${text(r.tva_intra)?.slice(0, 20) ?? null},
						${(text(r.country) ?? 'FR').slice(0, 2)}, 'dolibarr', ${Number(r.rowid)})
					RETURNING id`;
				if (email) taken.add(email);
				const line1 = text(r.address)?.split(/\r?\n/)[0];
				if (line1 && text(r.zip) && text(r.town)) {
					await tx`
						INSERT INTO address (customer_id, first_name, last_name, company, line1, line2,
							postal_code, city, country, phone, is_default_billing)
						VALUES (${created.id}, '', ${name}, ${isCompany ? name : null}, ${line1},
							${text(r.address)?.split(/\r?\n/).slice(1).join(' ') || null}, ${text(r.zip)},
							${text(r.town)}, ${(text(r.country) ?? 'FR').slice(0, 2)}, ${text(r.phone)}, true)`;
				}
			}
			if (notes.length) {
				await tx`
					UPDATE customer AS c SET private_note = n.note, updated_at = now()
					FROM jsonb_to_recordset(${tx.json(notes)}) AS n(doli int, note text)
					WHERE c.legacy_doli_id = n.doli AND c.private_note IS NULL`;
			}
			if (extras.length) {
				await tx`
					UPDATE customer AS c SET
						alias = coalesce(c.alias, CASE WHEN strpos(
							lower(concat_ws(' ', c.first_name, c.last_name, c.company_name)), lower(e.alias)
						) > 0 THEN NULL ELSE e.alias END),
						website = coalesce(c.website, e.website), fax = coalesce(c.fax, e.fax)
					FROM jsonb_to_recordset(${tx.json(extras)}) AS e(doli int, alias text, website text,
						fax text)
					WHERE c.legacy_doli_id = e.doli`;
			}
		});
		return {
			processed: links.length + creations.length,
			note: `${count(creations.length)} créés sans compte web`
		};
	}
};

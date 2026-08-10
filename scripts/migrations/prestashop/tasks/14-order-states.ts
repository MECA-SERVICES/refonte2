/**
 * Import des statuts de commande : `ps_order_state` → `order_state`.
 *
 * La source en compte **32**, la base cible n'en avait que 14 — les commandes
 * portant l'un des 18 statuts manquants se retrouvaient sur un statut par
 * défaut, ce qui fausse le suivi (« Erreur de paiement » 3 793 commandes,
 * « Remboursé » 1 100, « Rembourser par avoir » 101…).
 *
 * Les drapeaux métier (`paid`, `shipped`, `logable`) sont repris tels quels :
 * ils pilotent l'affichage côté client et les relances.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { slugify, text, bool } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

const ID_LANG = 1;

interface SourceState {
	id_order_state: number;
	name: string | null;
	color: string | null;
	paid: number;
	shipped: number;
	logable: number;
	hidden: number;
	send_email: number;
	deleted: number;
}

export const orderStatesTask: Task = {
	name: 'order-states',
	description: 'Statuts de commande (ps_order_state → order_state)',

	async run({ dryRun }) {
		const sql = targetDb();

		const rows = await sourceQuery<SourceState>(
			`SELECT s.id_order_state, s.color, s.paid, s.shipped, s.logable,
			        s.hidden, s.send_email, s.deleted, sl.name
			   FROM ps_order_state s
			   LEFT JOIN ps_order_state_lang sl
			          ON sl.id_order_state = s.id_order_state AND sl.id_lang = ${ID_LANG}
			  ORDER BY s.id_order_state`
		);
		log.muted(`${count(rows.length)} statuts en source`);

		const existing = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM order_state WHERE legacy_ps_id IS NOT NULL`;
		const already = new Set(existing.map((r) => Number(r.legacy_ps_id)));

		// Les `code` doivent rester uniques : la table en contient déjà 14, créés
		// à la main, dont les libellés peuvent coïncider avec ceux de la source.
		const codeRows = await sql<{ code: string }[]>`SELECT code FROM order_state`;
		const usedCodes = new Set(codeRows.map((r) => r.code));

		const toCreate = rows
			.filter((r) => !already.has(Number(r.id_order_state)))
			.map((r, i) => {
				const label = text(r.name) ?? `Statut ${r.id_order_state}`;
				let code = slugify(label) || `state-${r.id_order_state}`;
				if (usedCodes.has(code)) code = `${code}-ps${r.id_order_state}`;
				usedCodes.add(code);

				return {
					code,
					label,
					color: text(r.color) ?? '#9ca3af',
					position: (i + 1) * 10,
					is_paid: bool(r.paid),
					is_shipped: bool(r.shipped),
					// `logable` marque une commande comptabilisée : un état final au
					// sens du suivi client (livrée, remboursée, annulée).
					is_final: bool(r.logable) && bool(r.shipped),
					hide_from_client: bool(r.hidden) || bool(r.deleted),
					send_email_on_change: bool(r.send_email),
					legacy_ps_id: Number(r.id_order_state)
				};
			});

		if (dryRun) {
			log.warn(`Simulation : ${count(toCreate.length)} statuts auraient été créés.`);
			for (const s of toCreate.slice(0, 10)) {
				log.muted(`  [${s.legacy_ps_id}] ${s.label} → ${s.code}`);
			}
			return { processed: 0, note: 'simulation' };
		}

		if (toCreate.length === 0) {
			log.info('Tous les statuts sont déjà présents.');
			return { processed: 0, note: 'rien à faire' };
		}

		await sql`INSERT INTO order_state ${sql(toCreate)}`;
		log.success(`${count(toCreate.length)} statuts créés.`);

		return { processed: toCreate.length };
	}
};

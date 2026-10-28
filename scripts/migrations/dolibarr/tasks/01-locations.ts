/**
 * Import des emplacements de stock : `llx_entrepot` (Dolibarr) → `stock_location`.
 *
 * Dolibarr range le stock dans 375 « entrepôts » qui sont en réalité des
 * emplacements imbriqués : MAGASIN, ATELIER, GRENIER, puis « MAGASIN PIECES
 * DETACHEES / PARTIE DROITE / ETAGERE 41 / RANGEE 1 / BOITE 2 ». Le parent
 * se retrouve par le chemin, et le nom gardé est le dernier segment (voir
 * `../locations.ts` : `fk_parent` est faux sur 233 emplacements).
 *
 * Idempotent par `stock_location.legacy_doli_id = llx_entrepot.rowid` : une
 * seconde passe n'insère que les nouveaux emplacements, puis recâble tous les
 * parents.
 *
 * `lieu` devient aussi la description de l'emplacement, affichée au survol de
 * son code comme dans les écrans du module « UTILE ». Une description déjà
 * saisie dans MSShop n'est pas écrasée.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { insertBatched, targetDb } from '../../../lib/target-db.ts';
import { bool, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import {
	locationDescription,
	locationName,
	resolveParents,
	type DoliLocation
} from '../locations.ts';

interface SourceLocation extends DoliLocation {
	statut: number;
}

export const locationsTask: Task = {
	name: 'locations',
	description: 'Emplacements de stock (llx_entrepot → stock_location)',

	async run({ dryRun }) {
		const rows = await sourceQuery<SourceLocation>(
			`SELECT rowid, ref, lieu, fk_parent, statut FROM ${DOLI}.llx_entrepot ORDER BY rowid`
		);
		log.muted(`${count(rows.length)} emplacements en source`);

		const sql = targetDb();
		const existing = await sql<{ id: number; legacy_doli_id: number }[]>`
			SELECT id, legacy_doli_id FROM stock_location WHERE legacy_doli_id IS NOT NULL`;
		const imported = new Set(existing.map((r) => Number(r.legacy_doli_id)));

		const parentOf = resolveParents(rows);
		const toInsert = rows
			.filter((r) => !imported.has(Number(r.rowid)))
			.map((r) => ({
				name: locationName(r, parentOf.has(Number(r.rowid))),
				code: text(r.ref),
				description: locationDescription(r),
				// Ordre naturel des références (« 41 » avant « 42 ») ; 0 si non numérique.
				position: Number.parseInt(r.ref ?? '', 10) || 0,
				is_active: bool(r.statut),
				legacy_doli_id: Number(r.rowid)
			}));

		const parents = [...parentOf].map(([child, parent]) => ({ child, parent }));
		log.muted(`${count(parents.length)} rattachements retrouvés par le chemin`);

		if (dryRun) {
			log.warn(`Simulation : ${count(toInsert.length)} emplacements auraient été insérés.`);
			return { processed: 0, note: 'simulation' };
		}

		const inserted = await insertBatched('stock_location', toInsert);

		// Parents câblés après coup : un enfant peut précéder son parent dans la source.
		if (parents.length) {
			await sql`
				UPDATE stock_location AS child
				SET parent_id = parent.id, updated_at = now()
				FROM jsonb_to_recordset(${sql.json(parents)}) AS link(child int, parent int)
				JOIN stock_location AS parent ON parent.legacy_doli_id = link.parent
				WHERE child.legacy_doli_id = link.child
				  AND child.parent_id IS DISTINCT FROM parent.id`;
		}

		const descriptions = rows
			.map((r) => ({ doli: Number(r.rowid), description: locationDescription(r) }))
			.filter((d) => d.description);
		await sql`
			UPDATE stock_location AS l SET description = d.description, updated_at = now()
			FROM jsonb_to_recordset(${sql.json(descriptions)}) AS d(doli int, description text)
			WHERE l.legacy_doli_id = d.doli AND l.description IS NULL`;

		const skipped = rows.length - toInsert.length;
		return {
			processed: inserted,
			note: `${count(parents.length)} rattachements${skipped ? `, ${count(skipped)} déjà importés` : ''}`
		};
	}
};

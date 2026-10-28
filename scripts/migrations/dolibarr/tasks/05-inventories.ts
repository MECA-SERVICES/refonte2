/**
 * Inventaires annuels passés : module Dolibarr « UTILE » → `inventory`,
 * `inventory_count`, `inventory_serial`.
 *
 * - `utile_liste_inventaire` : les campagnes (« INVENTAIRE 2025 »…) ;
 * - `utile_inventaire` : une ligne par produit et emplacement (code de
 *   l'emplacement, pas son identifiant), quantité comptée et prix d'achat figé ;
 * - `utile_type_inv` : la répartition neuf / occasion / garantie de la ligne,
 *   clé `emplacement × 100 000 000 + produit` ;
 * - `utile_numero_serie` : les numéros de série comptés, même clé.
 *
 * Les campagnes reprises sont closes (`validated`) : elles servent
 * d'historique et de valorisation, pas de stock. Idempotent : les comptages
 * d'une campagne reprise sont remplacés à chaque passe.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { splitByCondition } from '../conditions.ts';

/** Clé d'une ligne UTILE : code d'emplacement × 10⁸ + identifiant produit. */
const lineKey = (inv: number, code: number, product: number) =>
	`${inv}:${code * 100_000_000 + product}`;

export const inventoriesTask: Task = {
	name: 'inventories',
	description: 'Inventaires passés (utile_liste_inventaire → inventory)',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const campaigns = await sourceQuery<{ id: number; nom: string; date_debut: Date | null }>(
			`SELECT id, nom, date_debut FROM ${DOLI}.utile_liste_inventaire`
		);
		const lines = await sourceQuery<{
			fk_inv_id: number;
			fk_product: number;
			entrepot: number;
			quantite: number;
			prix_achat_it: number | null;
			description: string | null;
			date_ajout: Date | null;
		}>(
			`SELECT fk_inv_id, fk_product, entrepot, quantite, prix_achat_it, description, date_ajout
				 FROM ${DOLI}.utile_inventaire WHERE quantite > 0`
		);
		const types = await sourceQuery<{
			id_inv: number;
			id_product_inv: number;
			type: number;
			quantity: number;
		}>(
			`SELECT id_inv, id_product_inv, type, sum(quantity) AS quantity FROM ${DOLI}.utile_type_inv
				 GROUP BY id_inv, id_product_inv, type`
		);
		const serials = await sourceQuery<{ id_inv: number; id_product_inv: number; lot: string }>(
			`SELECT id_inv, id_product_inv, lot FROM ${DOLI}.utile_numero_serie WHERE quantity > 0`
		);
		log.muted(`${count(campaigns.length)} campagnes, ${count(lines.length)} lignes comptées`);

		const sql = targetDb();
		const [products, locations] = await Promise.all([
			sql<{ id: number; doli: number }[]>`
				SELECT id, legacy_doli_id AS doli FROM product WHERE legacy_doli_id IS NOT NULL`,
			sql<
				{ id: number; code: string }[]
			>`SELECT id, code FROM stock_location WHERE code IS NOT NULL`
		]);
		const productOf = new Map(products.map((p) => [Number(p.doli), p.id]));
		const locationOf = new Map(locations.map((l) => [l.code.trim(), l.id]));

		const typesOf = new Map<string, { type: number; quantity: number }[]>();
		for (const t of types) {
			const key = `${t.id_inv}:${Number(t.id_product_inv)}`;
			typesOf.set(key, [
				...(typesOf.get(key) ?? []),
				{ type: Number(t.type), quantity: Number(t.quantity) }
			]);
		}

		let skipped = 0;
		const counts = lines.flatMap((l) => {
			const productId = productOf.get(Number(l.fk_product));
			const locationId = locationOf.get(String(l.entrepot));
			if (!productId || !locationId) {
				skipped++;
				return [];
			}
			const key = lineKey(Number(l.fk_inv_id), Number(l.entrepot), Number(l.fk_product));
			return splitByCondition(Number(l.quantite), typesOf.get(key) ?? []).map((s) => ({
				legacy_inventory: Number(l.fk_inv_id),
				key,
				product_id: productId,
				location_id: locationId,
				condition: s.condition,
				quantity: s.quantity,
				purchase_price: l.prix_achat_it === null ? null : Number(l.prix_achat_it).toFixed(4),
				note: text(l.description),
				updated_at: (l.date_ajout ? new Date(l.date_ajout) : new Date()).toISOString()
			}));
		});
		if (skipped) log.warn(`${count(skipped)} lignes sans produit ou emplacement MSShop, ignorées`);

		if (dryRun) {
			log.warn(`Simulation : ${count(counts.length)} comptages auraient été repris.`);
			return { processed: 0, note: 'simulation' };
		}

		await sql.begin(async (tx) => {
			const inventories = await tx<{ id: number; legacy_doli_id: number }[]>`
				INSERT INTO inventory (name, status, validated_at, legacy_doli_id, created_at)
				SELECT nom, 'validated', date_debut, id, coalesce(date_debut, now())
				FROM jsonb_to_recordset(${tx.json(
					campaigns.map((c) => ({
						id: Number(c.id),
						nom: c.nom.trim(),
						date_debut: c.date_debut ? new Date(c.date_debut).toISOString() : null
					}))
				)}) AS c(id int, nom text, date_debut timestamptz)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL
				DO UPDATE SET name = excluded.name, updated_at = now()
				RETURNING id, legacy_doli_id`;
			const inventoryOf = new Map(inventories.map((i) => [Number(i.legacy_doli_id), i.id]));
			const ids = [...inventoryOf.values()];
			await tx`DELETE FROM inventory_count WHERE inventory_id = ANY(${ids})`;

			const rows = counts.map(({ legacy_inventory, key: _key, ...c }) => ({
				...c,
				inventory_id: inventoryOf.get(legacy_inventory)
			}));
			const inserted = await tx<
				{ id: number; inventory_id: number; product_id: number; location_id: number }[]
			>`
				INSERT INTO inventory_count (inventory_id, product_id, location_id, condition, quantity,
					purchase_price, note, updated_at)
				SELECT inventory_id, product_id, location_id, condition, quantity, purchase_price, note, updated_at
				FROM jsonb_to_recordset(${tx.json(rows)}) AS c(inventory_id int, product_id int,
					location_id int, condition text, quantity int, purchase_price numeric, note text,
					updated_at timestamptz)
				RETURNING id, inventory_id, product_id, location_id`;

			// Un numéro de série se range sous la ligne comptée de son produit et emplacement.
			const lineOf = new Map<string, number>();
			for (const c of inserted) {
				lineOf.set(`${c.inventory_id}:${c.product_id}:${c.location_id}`, c.id);
			}
			const counted = new Map(counts.map((c) => [c.key, c]));
			const serialRows = serials.flatMap((s) => {
				const c = counted.get(`${s.id_inv}:${Number(s.id_product_inv)}`);
				const inventoryId = inventoryOf.get(Number(s.id_inv));
				const lineId = c && lineOf.get(`${inventoryId}:${c.product_id}:${c.location_id}`);
				const serial = s.lot.replace(/[\r\n]/g, '').trim();
				return lineId && serial ? [{ inventory_count_id: lineId, serial_number: serial }] : [];
			});
			await tx`
				INSERT INTO inventory_serial (inventory_count_id, serial_number)
				SELECT inventory_count_id, serial_number
				FROM jsonb_to_recordset(${tx.json(serialRows)}) AS s(inventory_count_id int, serial_number text)
				ON CONFLICT DO NOTHING`;
		});
		return { processed: counts.length, note: `${count(campaigns.length)} campagnes` };
	}
};

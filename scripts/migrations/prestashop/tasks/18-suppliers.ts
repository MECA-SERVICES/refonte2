/**
 * Fournisseurs (CDC 11) : `ps_supplier` (+ adresse `ps_address`) → `supplier`,
 * `ps_product_supplier` → `supplier_product`, `ps_product.id_supplier` →
 * `product.supplier_id` (fournisseur principal).
 *
 * - Une ligne par couple produit × fournisseur : la référence chez le
 *   fournisseur et son prix d'achat HT (quand il est renseigné). Les lignes
 *   de déclinaison (`id_product_attribute > 0`, 1 296) ne servent que si le
 *   produit n'a pas de ligne propre chez ce fournisseur. La devise n'est pas
 *   reprise : tous les prix sont en euros (`id_currency` est incohérent).
 * - PrestaShop fait foi jusqu'à la bascule : une seconde passe met à jour les
 *   conditions et le fournisseur principal. Les coordonnées complétées par la
 *   reprise Dolibarr (e-mail, SIRET…) ne sont jamais effacées.
 *
 * À lancer après `products`. Idempotent par `supplier.legacy_ps_id` et par
 * couple (fournisseur, produit).
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceCursor, sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { bool, text } from '../../../lib/transform.ts';
import { log, count, progress } from '../../../lib/logger.ts';

interface SourceSupplier {
	id_supplier: number;
	name: string;
	active: number;
	address1: string | null;
	address2: string | null;
	postcode: string | null;
	city: string | null;
	iso_code: string | null;
	phone: string | null;
	phone_mobile: string | null;
	vat_number: string | null;
	[key: string]: unknown;
}

interface SourceLink {
	id_product_supplier: number;
	id_product: number;
	id_supplier: number;
	product_supplier_reference: string | null;
	product_supplier_price_te: string | null;
	[key: string]: unknown;
}

interface SourceDefault {
	id_product: number;
	id_supplier: number;
	[key: string]: unknown;
}

const PAGE_SIZE = 20_000;
/** Au-delà, un prix d'achat PrestaShop est une erreur de saisie. */
const MAX_PURCHASE_PRICE = 100_000;

export const suppliersTask: Task = {
	name: 'suppliers',
	description: 'Fournisseurs et conditions (ps_supplier, ps_product_supplier → supplier)',
	dependsOn: ['products'],

	async run({ dryRun }) {
		const suppliers = await sourceQuery<SourceSupplier>(
			`SELECT s.id_supplier, s.name, s.active, a.address1, a.address2, a.postcode, a.city,
			        c.iso_code, a.phone, a.phone_mobile, a.vat_number
			   FROM ps_supplier s
			   LEFT JOIN ps_address a ON a.id_supplier = s.id_supplier AND a.deleted = 0
			   LEFT JOIN ps_country c ON c.id_country = a.id_country
			  ORDER BY s.id_supplier`
		);
		const [{ links, defaults }] = await sourceQuery<{ links: number; defaults: number }>(
			`SELECT (SELECT COUNT(*) FROM ps_product_supplier) AS links,
			        (SELECT COUNT(*) FROM ps_product WHERE id_supplier > 0) AS defaults`
		);
		log.muted(
			`${count(suppliers.length)} fournisseurs, ${count(Number(links))} conditions produit en source`
		);
		if (dryRun) {
			log.warn('Simulation : aucun fournisseur repris.');
			return { processed: 0, note: 'simulation' };
		}

		const sql = targetDb();
		// Une ligne par fournisseur, même s'il a plusieurs adresses (la première).
		const unique = suppliers.filter(
			(s, i) => suppliers.findIndex((t) => t.id_supplier === s.id_supplier) === i
		);
		const rows = unique.map((s) => ({
			legacy_ps_id: Number(s.id_supplier),
			name: text(s.name) ?? `Fournisseur ${s.id_supplier}`,
			is_active: bool(s.active),
			line1: text(s.address1),
			line2: text(s.address2),
			postal_code: text(s.postcode),
			city: text(s.city),
			country: (text(s.iso_code) ?? 'FR').slice(0, 2),
			phone: text(s.phone) ?? text(s.phone_mobile),
			vat_number: text(s.vat_number)
		}));
		await sql`
			INSERT INTO supplier (legacy_ps_id, name, is_active, line1, line2, postal_code, city, country,
				phone, vat_number)
			SELECT legacy_ps_id, name, is_active, line1, line2, postal_code, city, country, phone, vat_number
			FROM jsonb_to_recordset(${sql.json(rows)}) AS s(legacy_ps_id int, name text, is_active boolean,
				line1 text, line2 text, postal_code text, city text, country text, phone text,
				vat_number text)
			ON CONFLICT (legacy_ps_id) WHERE legacy_ps_id IS NOT NULL DO UPDATE SET
				name = excluded.name, is_active = excluded.is_active,
				line1 = coalesce(supplier.line1, excluded.line1),
				line2 = coalesce(supplier.line2, excluded.line2),
				postal_code = coalesce(supplier.postal_code, excluded.postal_code),
				city = coalesce(supplier.city, excluded.city),
				phone = coalesce(supplier.phone, excluded.phone),
				vat_number = coalesce(supplier.vat_number, excluded.vat_number),
				updated_at = now()`;

		// Conditions : jointure sur les identifiants PrestaShop côté cible, sans
		// charger 1,05 M de correspondances en mémoire.
		type LinkRow = { sup: number; pid: number; ref: string | null; price: string | null };
		const upsert = (batch: LinkRow[]) => sql`
			INSERT INTO supplier_product (supplier_id, product_id, supplier_reference, purchase_price)
			SELECT s.id, p.id, l.ref, l.price
			FROM jsonb_to_recordset(${sql.json(batch)}) AS l(sup int, pid int, ref text, price numeric)
			JOIN supplier s ON s.legacy_ps_id = l.sup
			JOIN product p ON p.legacy_ps_id = l.pid
			ON CONFLICT (supplier_id, product_id) DO UPDATE SET
				supplier_reference = excluded.supplier_reference,
				purchase_price = excluded.purchase_price, updated_at = now()`;
		// 141 prix PrestaShop sont aberrants (≈ 2 600 milliards d'euros, sur des
		// pièces ISEKI) : un prix d'achat de 100 000 € ou plus est laissé vide.
		let implausible = 0;
		const toRow = (r: SourceLink): LinkRow => {
			const price = Number(r.product_supplier_price_te);
			if (price >= MAX_PURCHASE_PRICE) implausible++;
			return {
				sup: Number(r.id_supplier),
				pid: Number(r.id_product),
				ref: text(r.product_supplier_reference),
				price: price > 0 && price < MAX_PURCHASE_PRICE ? r.product_supplier_price_te : null
			};
		};

		const bar = progress('conditions', Number(links));
		let read = 0;
		const select = `
			SELECT id_product_supplier, id_product, id_supplier, product_supplier_reference,
			       product_supplier_price_te
			  FROM ps_product_supplier
			 WHERE id_product_attribute = 0 AND id_supplier > 0 {{WHERE}}`;
		for await (const page of sourceCursor<SourceLink>(select, 'id_product_supplier', PAGE_SIZE)) {
			await upsert(page.map(toRow));
			read += page.length;
			bar.tick(read);
		}
		// Déclinaisons : seulement pour un couple que le produit n'a pas déjà.
		const variants = await sourceQuery<SourceLink>(
			`SELECT id_product_supplier, id_product, id_supplier, product_supplier_reference,
			        product_supplier_price_te
			   FROM ps_product_supplier
			  WHERE id_product_attribute > 0 AND id_supplier > 0
			  ORDER BY id_product_supplier`
		);
		const seen = new Set<string>();
		const extra = variants.map(toRow).filter((r) => {
			const key = `${r.sup}:${r.pid}`;
			return !seen.has(key) && seen.add(key);
		});
		if (extra.length) {
			await sql`
				INSERT INTO supplier_product (supplier_id, product_id, supplier_reference, purchase_price)
				SELECT s.id, p.id, l.ref, l.price
				FROM jsonb_to_recordset(${sql.json(extra)}) AS l(sup int, pid int, ref text, price numeric)
				JOIN supplier s ON s.legacy_ps_id = l.sup
				JOIN product p ON p.legacy_ps_id = l.pid
				ON CONFLICT (supplier_id, product_id) DO NOTHING`;
		}
		bar.done(read + variants.length);

		// Fournisseur principal : celui de la fiche PrestaShop. Seuls les produits
		// dont il change sont réécrits (une passe complète touche 1 M de lignes).
		const mainBar = progress('fournisseur principal', Number(defaults));
		let mains = 0;
		let changed = 0;
		for await (const page of sourceCursor<SourceDefault>(
			`SELECT id_product, id_supplier FROM ps_product WHERE id_supplier > 0 {{WHERE}}`,
			'id_product',
			PAGE_SIZE
		)) {
			const batch = page.map((r) => ({ pid: Number(r.id_product), sup: Number(r.id_supplier) }));
			const result = await sql`
				UPDATE product AS p SET supplier_id = s.id
				FROM jsonb_to_recordset(${sql.json(batch)}) AS l(pid int, sup int)
				JOIN supplier s ON s.legacy_ps_id = l.sup
				WHERE p.legacy_ps_id = l.pid AND p.supplier_id IS DISTINCT FROM s.id`;
			changed += result.count;
			mains += page.length;
			mainBar.tick(mains);
		}
		mainBar.done(mains);

		const [{ total }] = await sql<{ total: number }[]>`
			SELECT count(*)::int AS total FROM supplier_product`;
		if (implausible) log.warn(`${count(implausible)} prix d'achat aberrants laissés vides`);
		return {
			processed: suppliers.length,
			note: `${count(total)} conditions, ${count(changed)} fournisseurs principaux mis à jour`
		};
	}
};

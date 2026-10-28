/**
 * Produits : rattachement des produits Dolibarr au catalogue MSShop, puis
 * création de ceux qui n'existent que dans Dolibarr.
 *
 * Sont concernés les produits qui ont une ligne de stock (`llx_product_stock`)
 * ou qui figurent dans un inventaire (`utile_inventaire`). Chacun reçoit un
 * `product.legacy_doli_id`, sur lequel s'appuient les tâches suivantes (stock,
 * numéros de série, inventaires).
 *
 * Les produits absents de MSShop ont été créés directement dans Dolibarr, ou
 * importés du catalogue fournisseur, sans jamais passer par le site. Ils sont
 * créés **hors boutique** (`is_active = false`), dans « À classer », avec :
 * - le prix TTC de Dolibarr, qui fait foi (l'inventaire UTILE le corrige sans
 *   toucher au HT) : le HT en est déduit ;
 * - la marque lue après « | » dans le nom, à défaut celle du préfixe de
 *   référence (« ORE- » → Oregon) la plus fréquente dans MSShop.
 *
 * Idempotent : une seconde passe ne crée rien de plus. Liste de contrôle dans
 * `reports/dolibarr/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { insertBatched, targetDb } from '../../../lib/target-db.ts';
import { slugify, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { compactReference, matchProducts, partNumbers, type ShopProduct } from '../products.ts';

interface SourceProduct {
	rowid: number;
	ref: string;
	label: string | null;
	barcode: string | null;
	ref_ext: string | null;
	price_ttc: number | null;
	tva_tx: number | null;
	cost_price: number | null;
	description: string | null;
}

export const productsTask: Task = {
	name: 'products',
	description: 'Produits (llx_product → product : rattachement, puis création des manquants)',

	async run({ dryRun }) {
		const doli = await sourceQuery<SourceProduct>(
			`SELECT rowid, ref, label, barcode, ref_ext, price_ttc, tva_tx, cost_price, description
			 FROM ${DOLI}.llx_product
			 WHERE rowid IN (SELECT fk_product FROM ${DOLI}.llx_product_stock
			                 UNION SELECT fk_product FROM ${DOLI}.utile_inventaire)`
		);
		log.muted(`${count(doli.length)} produits Dolibarr en stock ou inventoriés`);

		const sql = targetDb();
		const linked = new Set(
			(
				await sql<{ doli: number }[]>`
					SELECT legacy_doli_id AS doli FROM product WHERE legacy_doli_id IS NOT NULL`
			).map((r) => Number(r.doli))
		);
		const pending = doli.filter((d) => !linked.has(Number(d.rowid)));
		log.muted(`${count(linked.size)} déjà rattachés, ${count(pending.length)} à traiter`);

		const refs = pending.map((d) => d.ref.trim());
		const eans = pending.map((d) => (d.barcode ?? '').trim()).filter(Boolean);
		const compacts = pending.map((d) => compactReference(d.ref)).filter(Boolean);
		const parts = pending.flatMap((d) => partNumbers(d.ref));
		const shop = await sql<ShopProduct[]>`
			SELECT id, reference, ean13, is_active AS "isActive", name, supplier_reference AS "supplierReference"
			FROM product
			WHERE legacy_doli_id IS NULL AND (
				reference = ANY(${refs}) OR ean13 = ANY(${eans})
				OR upper(regexp_replace(reference, '[\\s.\\-/_]', '', 'g')) = ANY(${compacts})
				OR upper(regexp_replace(regexp_replace(reference, '^[A-Za-z]+-', ''), '[\\s.\\-/_]', '', 'g')) = ANY(${parts})
				OR upper(regexp_replace(supplier_reference, '[\\s.\\-/_]', '', 'g')) = ANY(${parts})
			)`;
		const matches = matchProducts(
			pending.map((d) => ({
				rowid: Number(d.rowid),
				ref: d.ref,
				barcode: d.barcode,
				label: d.label
			})),
			shop
		);
		const kinds = Object.entries(
			[...matches.values()].reduce<Record<string, number>>(
				(acc, m) => ({ ...acc, [m.kind]: (acc[m.kind] ?? 0) + 1 }),
				{}
			)
		)
			.map(([k, n]) => `${k} ${n}`)
			.join(', ');
		const missing = pending.filter((d) => !matches.has(Number(d.rowid)));
		log.muted(
			`${count(matches.size)} rattachés (${kinds || 'aucun'}), ${count(missing.length)} à créer`
		);

		if (dryRun) {
			// Les rapprochements par numéro de pièce sont les moins sûrs : on les montre.
			const shopById = new Map(shop.map((p) => [p.id, p]));
			for (const d of pending) {
				const m = matches.get(Number(d.rowid));
				if (m?.kind !== 'part-number') continue;
				log.muted(
					`  ${d.ref} « ${d.label} » → ${shopById.get(m.productId)?.reference} « ${shopById.get(m.productId)?.name} »`
				);
			}
			log.warn('Simulation : aucun rattachement ni produit créé.');
			return { processed: 0, note: 'simulation' };
		}

		// 1. Rattachement des correspondances.
		const links = [...matches].map(([doliId, m]) => ({ product: m.productId, doli: doliId }));
		if (links.length) {
			await sql`
				UPDATE product AS p SET legacy_doli_id = link.doli, updated_at = now()
				FROM jsonb_to_recordset(${sql.json(links)}) AS link(product int, doli int)
				WHERE p.id = link.product AND p.legacy_doli_id IS NULL`;
		}

		// 2. Création des produits absents, hors boutique.
		const [unclassified] = await sql<{ id: number }[]>`
			SELECT id FROM category WHERE slug = 'a-classer' LIMIT 1`;
		const taxRuleOf = await taxRules(sql, missing);
		const brandOf = await brands(sql, missing);
		const rows = missing.map((d) => {
			const rate = Number(d.tva_tx ?? 20);
			const priceTtc = Number(d.price_ttc ?? 0);
			const name = (d.label ?? d.ref).replace(/\s+/g, ' ').trim();
			const ean = (d.barcode ?? '').trim();
			return {
				name,
				reference: d.ref.trim(),
				supplier_reference: text(d.ref_ext),
				ean13: /^\d{8,13}$/.test(ean) ? ean : null,
				brand_id: brandOf(d),
				slug: slugify(name) || slugify(d.ref),
				description: text(d.description),
				price_ht: (priceTtc / (1 + rate / 100)).toFixed(4),
				purchase_price: d.cost_price ? Number(d.cost_price).toFixed(4) : null,
				tax_rule_id: taxRuleOf(rate),
				category_id: unclassified?.id ?? null,
				is_active: false,
				legacy_doli_id: Number(d.rowid)
			};
		});
		const created = await insertBatched('product', rows);
		const shopById = new Map(shop.map((p) => [p.id, p]));
		const byPartNumber = pending.flatMap((d) => {
			const m = matches.get(Number(d.rowid));
			const p = m?.kind === 'part-number' ? shopById.get(m.productId) : undefined;
			return p ? [{ doli: d, shop: p }] : [];
		});
		if (created || byPartNumber.length) {
			log.muted(`Liste de contrôle : ${writeReport(missing, byPartNumber)}`);
		}

		return {
			processed: links.length + created,
			note: `${count(links.length)} rattachés, ${count(created)} créés hors boutique`
		};
	}
};

/** Règle de TVA par taux ; le taux réduit à 10 % (paysager) est créé s'il manque. */
async function taxRules(sql: ReturnType<typeof targetDb>, products: SourceProduct[]) {
	const rates = [...new Set(products.map((p) => Number(p.tva_tx ?? 20)))];
	const existing = await sql<{ id: number; rate: string }[]>`SELECT id, rate FROM tax_rule`;
	const byRate = new Map(existing.map((r) => [Number(r.rate), r.id]));
	for (const rate of rates) {
		if (byRate.has(rate)) continue;
		const [row] = await sql<{ id: number }[]>`
			INSERT INTO tax_rule (name, rate) VALUES (${`Taux ${rate} %`}, ${rate}) RETURNING id`;
		byRate.set(rate, row.id);
	}
	return (rate: number) => byRate.get(rate) ?? null;
}

/** Marque : le nom après « | », à défaut la marque la plus fréquente du préfixe. */
async function brands(sql: ReturnType<typeof targetDb>, products: SourceProduct[]) {
	const all = await sql<{ id: number; name: string }[]>`SELECT id, name FROM brand`;
	const byName = new Map(all.map((b) => [b.name.trim().toUpperCase(), b.id]));
	const prefixes = [...new Set(products.map((p) => p.ref.split('-')[0].toUpperCase()))];
	const byPrefix = new Map(
		(
			await sql<{ prefix: string; brand_id: number }[]>`
				SELECT DISTINCT ON (prefix) prefix, brand_id FROM (
					SELECT upper(split_part(reference, '-', 1)) AS prefix, brand_id, count(*) AS n
					FROM product WHERE brand_id IS NOT NULL
					  AND upper(split_part(reference, '-', 1)) = ANY(${prefixes})
					GROUP BY 1, 2
				) t ORDER BY prefix, n DESC`
		).map((r) => [r.prefix, r.brand_id])
	);
	return (p: SourceProduct) =>
		byName.get((p.label ?? '').split('|')[1]?.trim().toUpperCase() ?? '') ??
		byPrefix.get(p.ref.split('-')[0].toUpperCase()) ??
		null;
}

/**
 * Liste de contrôle en CSV (séparateur `;`) : les produits créés, puis les
 * rattachements par numéro de pièce, les moins sûrs, à relire.
 */
function writeReport(
	created: SourceProduct[],
	byPartNumber: { doli: SourceProduct; shop: ShopProduct }[]
): string {
	const dir = join(process.cwd(), 'reports', 'dolibarr');
	mkdirSync(dir, { recursive: true });
	const file = join(dir, `produits-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.csv`);
	const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
	const row = (values: unknown[]) => values.map(cell).join(';');
	const lines = [
		`# ${created.length} produits créés hors boutique`,
		row(['dolibarr_id', 'reference', 'nom', 'ean', 'prix_ttc', 'prix_achat']),
		...created.map((p) => row([p.rowid, p.ref, p.label, p.barcode, p.price_ttc, p.cost_price])),
		'',
		`# ${byPartNumber.length} rattachements par numéro de pièce, à vérifier`,
		row([
			'dolibarr_id',
			'reference_dolibarr',
			'nom_dolibarr',
			'msshop_id',
			'reference_msshop',
			'nom_msshop'
		]),
		...byPartNumber.map(({ doli, shop }) =>
			row([doli.rowid, doli.ref, doli.label, shop.id, shop.reference, shop.name])
		)
	];
	writeFileSync(file, '\uFEFF' + lines.join('\n') + '\n');
	return file;
}

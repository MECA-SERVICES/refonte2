/**
 * Fournisseurs Dolibarr → `supplier`, sur ceux déjà repris de PrestaShop
 * (`migrate:ps -- --only=suppliers`) :
 *
 * - les 51 tiers fournisseurs (`llx_societe.fournisseur = 1`) : code, e-mail,
 *   téléphone, adresse, SIRET, TVA, note. Un fournisseur présent dans les deux
 *   logiciels (`SAME_AS_PS`) est complété, jamais dupliqué ; seuls les champs
 *   vides sont remplis. Les autres (transporteurs, matériaux, magasins…) sont
 *   créés ;
 * - les prix d'achat Dolibarr (`llx_product_fournisseur_price`, 69) →
 *   `supplier_product` ;
 * - le fournisseur des bons de réception UTILE, saisi en texte (`marque`) →
 *   `stock_voucher.supplier_id` (`RECEIPT_SUPPLIERS`) ; les régularisations
 *   (« REGUL… », « RETOUR CLIENT SITE »…) n'ont pas de fournisseur ;
 * - un produit sans fournisseur principal prend celui de sa dernière
 *   réception (produits créés dans Dolibarr, jamais passés par PrestaShop).
 *
 * Idempotent par `supplier.legacy_doli_id`.
 */
import type { Task } from '../../../lib/runner.ts';
import { DOLI, sourceQuery } from '../source.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { htmlText, text } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';
import { htmlLines } from '../lines.ts';

interface SourceSupplier {
	rowid: number;
	nom: string;
	code_fournisseur: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	zip: string | null;
	town: string | null;
	country: string | null;
	siret: string | null;
	tva_intra: string | null;
	note_private: string | null;
	status: number;
	url: string | null;
	fax: string | null;
	siren: string | null;
	ape: string | null;
	idprof4: string | null;
	capital: number | null;
}

interface SourcePrice {
	fk_product: number;
	fk_soc: number;
	ref_fourn: string | null;
	unitprice: number | null;
	quantity: number | null;
	delivery_time_days: number | null;
	desc_fourn: string | null;
}

/** Tiers Dolibarr (`llx_societe.rowid`) déjà repris de PrestaShop (`ps_supplier.id_supplier`). */
const SAME_AS_PS: Record<number, number> = {
	20: 4, // KRAMP
	2: 11, // ISEKI FRANCE — ISEKI
	9: 16, // HUSQVARNA FRANCE — HUSQVARNA - JONSERED
	26026: 5, // MAKITA FRANCE — MAKITA
	18: 9, // SABRE FRANCE
	5: 22, // SNA EUROPE FRANCE (BAHCO) — BAHCO
	8: 10, // ETESIA
	3: 3, // OUTILS WOLF
	16: 7, // OREGON TOOL FRANCE — OREGON
	19: 28, // SAELEN — Saelen
	26865: 31, // ANOVA - MILLASUR
	26614: 26, // DIMACO Constructeur — DIMACO
	26626: 23, // GRANIT
	26633: 29, // TIELBURGER
	26622: 19 // RATIOPART — RATIOPARTS
};

/**
 * Fournisseur d'un bon de réception UTILE, d'après le texte saisi : un
 * fournisseur PrestaShop (`ps`), un tiers Dolibarr (`doli`), ou un fournisseur
 * à créer sous ce nom (`name`). Un texte absent d'ici n'est pas un fournisseur.
 */
const RECEIPT_SUPPLIERS: Record<string, { ps: number } | { doli: number } | { name: string }> = {
	KRAMP: { ps: 4 },
	'OUTILS WOLF': { ps: 3 },
	'OUTIS WOLF': { ps: 3 },
	ISEKI: { ps: 11 },
	'ISEKI BANNER': { ps: 11 },
	SABRE: { ps: 9 },
	'SABRE FRANCE': { ps: 9 },
	MAKITA: { ps: 5 },
	HUSQVARNA: { ps: 16 },
	OREGON: { ps: 7 },
	'SNA EUROPE': { ps: 22 },
	SAELEN: { ps: 28 },
	ETESIA: { ps: 10 },
	GRANIT: { ps: 23 },
	DIMACO: { ps: 26 },
	'SAT DIMACO': { ps: 26 },
	TIELBURGER: { ps: 29 },
	'JS FOURNITURES': { ps: 25 },
	'F1 DISTRIBUTION': { ps: 15 },
	'IMI JARDIN SAS': { doli: 10 },
	BUGNOT: { doli: 4 },
	JARDINET: { doli: 26620 },
	PENET: { doli: 12 },
	ALKO: { name: 'AL-KO' },
	AMAZON: { name: 'AMAZON' },
	BRUMAR: { name: 'BRUMAR' },
	ENTECH: { name: 'ENTECH' },
	'HOFER CHEMIE GMBH': { name: 'HOFER CHEMIE GMBH' }
};

export const suppliersTask: Task = {
	name: 'suppliers',
	description: 'Fournisseurs (llx_societe fournisseurs → supplier), prix d’achat, réceptions',

	async run({ dryRun }) {
		// Lectures en série : la connexion Dolibarr s'ouvre à la première requête.
		const suppliers = await sourceQuery<SourceSupplier>(
			`SELECT s.rowid, s.nom, s.code_fournisseur, s.email, s.phone, s.address, s.zip, s.town,
			        c.code AS country, s.siret, s.tva_intra, s.note_private, s.status, s.url, s.fax,
			        s.siren, s.ape, s.idprof4, s.capital
			 FROM ${DOLI}.llx_societe s
			 LEFT JOIN ${DOLI}.llx_c_country c ON c.rowid = s.fk_pays
			 WHERE s.fournisseur = 1
			 ORDER BY s.rowid`
		);
		const prices = await sourceQuery<SourcePrice>(
			`SELECT fk_product, fk_soc, ref_fourn, unitprice, quantity, delivery_time_days, desc_fourn
			 FROM ${DOLI}.llx_product_fournisseur_price`
		);
		log.muted(
			`${count(suppliers.length)} fournisseurs, ${count(prices.length)} prix d'achat en source`
		);

		const sql = targetDb();
		const psSuppliers = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM supplier WHERE legacy_ps_id IS NOT NULL`;
		const known = new Set(psSuppliers.map((s) => Number(s.legacy_ps_id)));
		const missing = Object.values(SAME_AS_PS).filter((ps) => !known.has(ps));
		if (missing.length) {
			throw new Error(
				'Fournisseurs PrestaShop absents : lancer d’abord `bun run migrate:ps -- --only=suppliers`.'
			);
		}
		const merged = suppliers.filter((s) => SAME_AS_PS[Number(s.rowid)]).length;
		log.muted(
			`${count(merged)} déjà repris de PrestaShop (complétés), ${count(suppliers.length - merged)} à créer ou mettre à jour`
		);
		if (dryRun) {
			log.warn('Simulation : aucun fournisseur repris.');
			return { processed: 0, note: 'simulation' };
		}

		const rows = suppliers.map((s) => {
			const lines = (text(s.address) ?? '').split(/\r?\n/).filter(Boolean);
			const siret = text(s.siret)?.replace(/\s/g, '');
			return {
				legacy_doli_id: Number(s.rowid),
				legacy_ps_id: SAME_AS_PS[Number(s.rowid)] ?? null,
				name: s.nom.replace(/\s+/g, ' ').trim(),
				code: text(s.code_fournisseur),
				email: text(s.email)?.toLowerCase() ?? null,
				phone: text(s.phone),
				line1: lines[0] ?? null,
				line2: lines.slice(1).join(' ') || null,
				postal_code: text(s.zip),
				city: text(s.town),
				country: (text(s.country) ?? 'FR').slice(0, 2),
				siret: siret && /^\d{14}$/.test(siret) ? siret : null,
				vat_number: text(s.tva_intra),
				notes: text(htmlText(s.note_private)),
				is_active: Number(s.status) === 1,
				website: text(s.url),
				fax: text(s.fax),
				naf_code: text(s.ape)?.toUpperCase() ?? null,
				// Le n° RCS, sinon le SIREN qui en tient lieu.
				rcs: text(s.idprof4) ?? (text(s.siren) ? `SIREN ${text(s.siren)}` : null),
				share_capital: s.capital ? Number(s.capital).toFixed(2) : null
			};
		});

		const result = await sql.begin(async (tx) => {
			// Fournisseurs communs : la fiche PrestaShop est complétée.
			await tx`
				UPDATE supplier AS s SET
					legacy_doli_id = r.legacy_doli_id,
					code = coalesce(s.code, r.code), email = coalesce(s.email, r.email),
					phone = coalesce(s.phone, r.phone), line1 = coalesce(s.line1, r.line1),
					line2 = coalesce(s.line2, r.line2), postal_code = coalesce(s.postal_code, r.postal_code),
					city = coalesce(s.city, r.city), siret = coalesce(s.siret, r.siret),
					vat_number = coalesce(s.vat_number, r.vat_number), notes = coalesce(s.notes, r.notes),
					updated_at = now()
				FROM jsonb_to_recordset(${tx.json(rows.filter((r) => r.legacy_ps_id))}) AS r(
					legacy_doli_id int, legacy_ps_id int, code text, email text, phone text, line1 text,
					line2 text, postal_code text, city text, siret text, vat_number text, notes text)
				WHERE s.legacy_ps_id = r.legacy_ps_id`;
			// Les autres : créés, ou mis à jour sans effacer une saisie MSShop.
			await tx`
				INSERT INTO supplier (legacy_doli_id, name, code, email, phone, line1, line2, postal_code,
					city, country, siret, vat_number, notes, is_active)
				SELECT legacy_doli_id, name, code, email, phone, line1, line2, postal_code, city, country,
					siret, vat_number, notes, is_active
				FROM jsonb_to_recordset(${tx.json(rows.filter((r) => !r.legacy_ps_id))}) AS r(
					legacy_doli_id int, name text, code text, email text, phone text, line1 text, line2 text,
					postal_code text, city text, country text, siret text, vat_number text, notes text,
					is_active boolean)
				ON CONFLICT (legacy_doli_id) WHERE legacy_doli_id IS NOT NULL DO UPDATE SET
					code = coalesce(supplier.code, excluded.code),
					email = coalesce(supplier.email, excluded.email),
					phone = coalesce(supplier.phone, excluded.phone),
					siret = coalesce(supplier.siret, excluded.siret), updated_at = now()`;

			// Site, fax et informations légales, sans effacer une saisie MSShop.
			await tx`
				UPDATE supplier AS s SET
					website = coalesce(s.website, r.website), fax = coalesce(s.fax, r.fax),
					naf_code = coalesce(s.naf_code, r.naf_code), rcs = coalesce(s.rcs, r.rcs),
					share_capital = coalesce(s.share_capital, r.share_capital), updated_at = now()
				FROM jsonb_to_recordset(${tx.json(rows)}) AS r(legacy_doli_id int, website text, fax text,
					naf_code text, rcs text, share_capital numeric)
				WHERE s.legacy_doli_id = r.legacy_doli_id
					AND (r.website, r.fax, r.naf_code, r.rcs, r.share_capital) IS DISTINCT FROM
						(NULL, NULL, NULL, NULL, NULL)`;

			// Fournisseurs nommés seulement sur des réceptions.
			for (const target of Object.values(RECEIPT_SUPPLIERS)) {
				if (!('name' in target)) continue;
				await tx`
					INSERT INTO supplier (name)
					SELECT ${target.name}
					WHERE NOT EXISTS (SELECT 1 FROM supplier WHERE lower(name) = lower(${target.name}))`;
			}

			// Prix d'achat Dolibarr : un par palier de quantité ; MSShop garde le
			// premier palier de chaque couple produit × fournisseur.
			const firstTier = [...prices]
				.sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
				.filter(
					(p, i, all) =>
						all.findIndex((q) => q.fk_product === p.fk_product && q.fk_soc === p.fk_soc) === i
				);
			const priceRows = firstTier.map((p) => ({
				doli_product: Number(p.fk_product),
				doli_supplier: Number(p.fk_soc),
				ref: text(p.ref_fourn),
				price: p.unitprice && Number(p.unitprice) > 0 ? Number(p.unitprice).toFixed(4) : null,
				min: p.quantity && Number(p.quantity) > 1 ? Math.round(Number(p.quantity)) : null,
				days: p.delivery_time_days ? Number(p.delivery_time_days) : null,
				description: htmlLines(p.desc_fourn) || null
			}));
			const priced = await tx`
				INSERT INTO supplier_product (supplier_id, product_id, supplier_reference, purchase_price,
					min_quantity, delivery_days, description)
				SELECT s.id, p.id, r.ref, r.price, r.min, r.days, r.description
				FROM jsonb_to_recordset(${tx.json(priceRows)}) AS r(doli_product int, doli_supplier int,
					ref text, price numeric, min int, days int, description text)
				JOIN supplier s ON s.legacy_doli_id = r.doli_supplier
				JOIN product p ON p.legacy_doli_id = r.doli_product
				ON CONFLICT (supplier_id, product_id) DO UPDATE SET
					supplier_reference = coalesce(excluded.supplier_reference, supplier_product.supplier_reference),
					purchase_price = coalesce(excluded.purchase_price, supplier_product.purchase_price),
					min_quantity = coalesce(excluded.min_quantity, supplier_product.min_quantity),
					delivery_days = coalesce(excluded.delivery_days, supplier_product.delivery_days),
					description = coalesce(supplier_product.description, excluded.description),
					updated_at = now()`;

			// Fournisseur des bons de réception, d'après le texte saisi.
			let receipts = 0;
			for (const [label, target] of Object.entries(RECEIPT_SUPPLIERS)) {
				const match =
					'ps' in target
						? tx`legacy_ps_id = ${target.ps}`
						: 'doli' in target
							? tx`legacy_doli_id = ${target.doli}`
							: tx`lower(name) = lower(${target.name})`;
				const updated = await tx`
					UPDATE stock_voucher SET supplier_id = (SELECT id FROM supplier WHERE ${match} LIMIT 1)
					WHERE kind = 'receipt' AND upper(trim(supplier)) = ${label} AND supplier_id IS NULL`;
				receipts += updated.count;
			}

			// Produit sans fournisseur principal : celui de sa dernière réception,
			// rattaché aussi dans ses conditions.
			const orphans = await tx<{ product_id: number; supplier_id: number }[]>`
				SELECT DISTINCT ON (m.product_id) m.product_id, v.supplier_id
				FROM stock_movement m
				JOIN stock_voucher v ON v.id = m.voucher_id
				JOIN product p ON p.id = m.product_id
				WHERE v.kind = 'receipt' AND v.supplier_id IS NOT NULL AND p.supplier_id IS NULL
				ORDER BY m.product_id, v.created_at DESC`;
			if (orphans.length) {
				await tx`
					INSERT INTO supplier_product (supplier_id, product_id)
					SELECT supplier_id, product_id
					FROM jsonb_to_recordset(${tx.json(orphans)}) AS o(product_id int, supplier_id int)
					ON CONFLICT (supplier_id, product_id) DO NOTHING`;
				await tx`
					UPDATE product AS p SET supplier_id = o.supplier_id
					FROM jsonb_to_recordset(${tx.json(orphans)}) AS o(product_id int, supplier_id int)
					WHERE p.id = o.product_id AND p.supplier_id IS NULL`;
			}
			// Puis, à défaut, celui d'un prix d'achat Dolibarr.
			const fromPrices = await tx`
				UPDATE product AS p SET supplier_id = sp.supplier_id
				FROM (SELECT DISTINCT ON (sp.product_id) sp.product_id, sp.supplier_id
				      FROM supplier_product sp JOIN supplier s ON s.id = sp.supplier_id
				      WHERE s.legacy_doli_id IS NOT NULL
				      ORDER BY sp.product_id, sp.purchase_price NULLS LAST) AS sp
				WHERE p.id = sp.product_id AND p.supplier_id IS NULL`;
			return {
				priced: priced.count,
				receipts,
				mains: orphans.length + fromPrices.count
			};
		});

		log.muted(
			`${count(result.priced)} prix d'achat, ${count(result.receipts)} réceptions rattachées, ${count(result.mains)} produits reçoivent un fournisseur principal`
		);
		return {
			processed: suppliers.length,
			note: `${count(result.receipts)} réceptions, ${count(result.mains)} fournisseurs principaux`
		};
	}
};

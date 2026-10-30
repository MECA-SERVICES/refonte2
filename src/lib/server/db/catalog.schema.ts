import {
	pgTable,
	serial,
	integer,
	text,
	varchar,
	boolean,
	numeric,
	timestamp,
	jsonb,
	uniqueIndex,
	index,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { DeliveryTimeMode } from '$lib/delivery-time';

/**
 * Domaine « Catalogue » — marques, catégories, produits, variantes, médias, relations.
 *
 * Traçabilité de la reprise PrestaShop : chaque table porte un `legacy_ps_id` nullable
 * renseigné par le futur import des données.
 */

// ---------------------------------------------------------------------------
// Marques
// ---------------------------------------------------------------------------

export const brand = pgTable(
	'brand',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		logoUrl: text('logo_url'),

		// Page de marque (CDC 12) : contenu éditorial modifiable en back-office.
		/** Visuel pleine largeur du bandeau. */
		heroImageUrl: text('hero_image_url'),
		/** Accroche affichée sous le nom, dans l'encart du bandeau. */
		tagline: text('tagline'),
		/** Présentation rédigée, en HTML assaini à l'affichage. */
		pageContent: text('page_content'),
		metaTitle: text('meta_title'),
		metaDescription: text('meta_description'),
		isActive: boolean('is_active').notNull().default(true),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('brand_slug_idx').on(t.slug)]
);

// ---------------------------------------------------------------------------
// Catégories (arborescence via parent_id auto-référent)
// ---------------------------------------------------------------------------

/**
 * Origine d'une catégorie — trace *qui* l'a créée.
 *
 * Sans cette distinction, impossible de rejouer la taxonomie : on ne saurait
 * plus séparer les nœuds construits par règles de ceux repris de PrestaShop ou
 * ajustés à la main. Voir `MIGRATION-CATALOGUE.md` §4.1 règle n°7.
 */
export const categorySource = [
	'rule', // créée par le moteur de reclassification (familles de pièces)
	'legacy', // reprise telle quelle de PrestaShop (taxonomie produits)
	'manual', // créée ou corrigée par un humain
	'supplier' // issue d'un catalogue fournisseur
] as const;
export type CategorySource = (typeof categorySource)[number];

export const category = pgTable(
	'category',
	{
		id: serial('id').primaryKey(),
		parentId: integer('parent_id').references((): AnyPgColumn => category.id, {
			onDelete: 'set null'
		}),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		isActive: boolean('is_active').notNull().default(true),
		position: integer('position').notNull().default(0),

		/** Origine du nœud — voir `categorySource`. */
		source: text('source').notNull().default('legacy'),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('category_slug_idx').on(t.slug), index('category_parent_idx').on(t.parentId)]
);

// ---------------------------------------------------------------------------
// Règles de TVA
// ---------------------------------------------------------------------------

export const taxRule = pgTable('tax_rule', {
	id: serial('id').primaryKey(),
	/** Libellé, ex. « Taux normal 20 % ». */
	name: text('name').notNull(),
	/** Taux en pourcentage, ex. 20.00, 5.50. */
	rate: numeric('rate', { precision: 6, scale: 3 }).notNull(),
	isActive: boolean('is_active').notNull().default(true),
	/** Taux appliqué par défaut aux nouveaux produits. */
	isDefault: boolean('is_default').notNull().default(false),

	legacyPsId: integer('legacy_ps_id'),

	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Fournisseurs (CDC 11)
// ---------------------------------------------------------------------------

/**
 * Fournisseur, repris de PrestaShop (`ps_supplier`, adresse `ps_address`) et
 * de Dolibarr (tiers fournisseurs : coordonnées, SIRET). Un fournisseur
 * archivé n'est plus proposé (R4) ; rattaché à des produits, il ne se
 * supprime pas (R5). Ses données ne sont jamais montrées au client (R6).
 */
export const supplier = pgTable(
	'supplier',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		/** Code fournisseur Dolibarr (`SU2111-00019`). */
		code: text('code'),
		email: text('email'),
		phone: text('phone'),
		line1: text('line1'),
		line2: text('line2'),
		postalCode: text('postal_code'),
		city: text('city'),
		country: text('country').notNull().default('FR'),
		siret: text('siret'),
		vatNumber: text('vat_number'),
		/** Code NAF / APE (`2830Z`). */
		nafCode: text('naf_code'),
		/** Immatriculation au RCS (« Angers B 393 727 797 »). */
		rcs: text('rcs'),
		shareCapital: numeric('share_capital', { precision: 14, scale: 2 }),
		website: text('website'),
		fax: text('fax'),
		/** Notes internes. */
		notes: text('notes'),
		isActive: boolean('is_active').notNull().default(true),
		/** Reprise PrestaShop : `ps_supplier.id_supplier`. */
		legacyPsId: integer('legacy_ps_id'),
		/** Reprise Dolibarr : `llx_societe.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('supplier_legacy_ps_id_idx')
			.on(t.legacyPsId)
			.where(sql`${t.legacyPsId} IS NOT NULL`),
		uniqueIndex('supplier_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

/**
 * Nature d'un produit — la séparation « pièces » / « produits » du catalogue.
 *
 * Elle est portée par une **colonne**, pas par la branche de rangement : à la
 * source, la séparation par l'arbre n'est pas fiable (la branche
 * « Électroportatif » contient 92 % de pièces, voir `MIGRATION-CATALOGUE.md`
 * §3.4). Un champ explicite ne peut pas dériver au fil des reclassements, et
 * rend la distinction interrogeable sans parcourir l'arbre.
 */
export const productType = [
	'part', // pièce détachée — ~99,7 % du catalogue
	'machine', // machine ou produit fini (tondeuse, tronçonneuse…)
	'consumable', // consommable (huile, filtre neuf, EPI…)
	/*
	 * Frais de port, main-d'œuvre : non physique, sans stock.
	 *
	 * Reprise Dolibarr : les services de main-d'œuvre facturés au comptoir
	 * (`MO-T1`, `MO-T3`, `MO-AFFUT-CHAINE`…, `llx_product.fk_product_type = 1`)
	 * deviennent des produits de ce type. Un service n'est pas vendu en ligne :
	 * il est créé inactif (`isActive` règle la visibilité en boutique).
	 */
	'service'
] as const;
export type ProductType = (typeof productType)[number];

export const product = pgTable(
	'product',
	{
		id: serial('id').primaryKey(),

		// Utils
		isActive: boolean('is_active').notNull().default(true),

		/** Nature du produit — voir `productType`. Défaut `part` : le catalogue
		 *  est à 99,7 % des pièces, l'exception est la machine. */
		type: text('type').notNull().default('part'),

		// Identification
		name: text('name').notNull(),
		/** SKU interne. */
		reference: text('reference').notNull(),
		/** Référence fournisseur. */
		supplierReference: text('supplier_reference'),
		/** Code-barres EAN13. */
		ean13: varchar('ean13', { length: 13 }),
		brandId: integer('brand_id').references(() => brand.id, { onDelete: 'set null' }),

		// SEO / présentation
		slug: text('slug').notNull(),
		shortDescription: text('short_description'),
		description: text('description'),
		metaTitle: text('meta_title'),
		metaDescription: text('meta_description'),

		// Tarification
		priceHt: numeric('price_ht', { precision: 12, scale: 4 }).notNull(),
		/** Prix HT barré (avant remise). */
		priceHtStrike: numeric('price_ht_strike', { precision: 12, scale: 4 }),
		purchasePrice: numeric('purchase_price', { precision: 12, scale: 4 }),
		/** Règle de TVA appliquée (null = pas de TVA / exonéré). */
		taxRuleId: integer('tax_rule_id').references(() => taxRule.id, { onDelete: 'set null' }),
		/**
		 * Éco-participation (DEEE), en euros TTC, à afficher et facturer en plus
		 * du prix.
		 *
		 * **Obligation légale** : le montant doit être affiché distinctement du
		 * prix de vente. Mesuré sur la source le 2026-08-08 : 1 673 produits
		 * concernés, de 0,42 € à 2,08 €.
		 */
		ecotax: numeric('ecotax', { precision: 10, scale: 2 }).notNull().default('0'),

		// Stock & logistique
		/** Quantité physiquement détenue. */
		stock: integer('stock').notNull().default(0),

		/*
		 * Quantité minimale par commande.
		 *
		 * Distincte du stock : elle ne dit pas ce qu'on possède mais ce qu'un
		 * client doit acheter d'un coup — visserie vendue par 10, joints par
		 * lot. Le sélecteur de quantité de la fiche produit part de cette
		 * valeur et n'accepte pas moins.
		 */
		minOrderQuantity: integer('min_order_quantity').notNull().default(1),

		/** Emplacement physique en atelier : allée, étagère, bac. */
		stockLocation: text('stock_location'),

		/** Code comptable de vente (Dolibarr : `accountancy_code_sell`, demande 2.1). */
		accountingCode: text('accounting_code'),

		/*
		 * Seuil d'alerte de réapprovisionnement.
		 *
		 * `0` désactive l'alerte. Sert au back-office, jamais affiché au
		 * client.
		 */
		lowStockThreshold: integer('low_stock_threshold').notNull().default(0),

		/** Date de réapprovisionnement annoncée, si elle est connue. */
		availableDate: timestamp('available_date', { withTimezone: true }),
		weightKg: numeric('weight_kg', { precision: 10, scale: 3 }),
		lengthCm: numeric('length_cm', { precision: 10, scale: 2 }),
		widthCm: numeric('width_cm', { precision: 10, scale: 2 }),
		heightCm: numeric('height_cm', { precision: 10, scale: 2 }),
		shippingExtraFee: numeric('shipping_extra_fee', { precision: 10, scale: 2 }),
		/**
		 * Le produit peut-il être **commandé** ?
		 *
		 * Distinct de `isActive`, qui contrôle la visibilité : un produit peut
		 * rester consultable (fiche, recherche, référencement) sans être
		 * commandable en ligne — sur devis, en rupture définitive, réservé au
		 * comptoir. Mettre ces produits à `isActive = false` les ferait
		 * disparaître du site, ce qui n'est pas ce que la source exprime.
		 *
		 * Mesuré le 2026-08-08 : **36 235 produits non commandables** en source.
		 * Sans cette colonne, ils seraient tous vendables à tort.
		 */
		availableForOrder: boolean('available_for_order').notNull().default(true),
		/*
		 * Messages de délai affichés sur la fiche produit.
		 *
		 * Repris de PrestaShop, onglet « Livraison » : trois régimes possibles —
		 * aucun message, le message par défaut de la boutique, ou un message
		 * propre au produit.
		 *
		 * Deux textes libres plutôt qu'un délai en jours : l'atelier écrit
		 * « EXPEDITION SOUS 24H A 48H » comme « Nous consulter », et un nombre ne
		 * saurait porter le second cas.
		 */
		deliveryTimeMode: text('delivery_time_mode')
			.$type<DeliveryTimeMode>()
			.notNull()
			.default('default'),
		/** Message affiché quand le produit est en stock. */
		deliveryTimeInStock: text('delivery_time_in_stock'),
		/** Message affiché en rupture, quand la commande reste autorisée. */
		deliveryTimeOutOfStock: text('delivery_time_out_of_stock'),

		/** Transporteur forcé — FK à brancher quand le domaine livraison existera. */
		forcedCarrierId: integer('forced_carrier_id'),
		/** Fournisseur principal (CDC 11, R2) : ses conditions sont dans `supplier_product`. */
		supplierId: integer('supplier_id').references(() => supplier.id, { onDelete: 'set null' }),

		// Catégorisation : catégorie principale (les catégories additionnelles
		// passent par la table de liaison product_category).
		categoryId: integer('category_id').references(() => category.id, { onDelete: 'set null' }),

		// Traçabilité import
		legacyPsId: integer('legacy_ps_id'),
		/**
		 * Reprise Dolibarr : `llx_product.rowid` du produit correspondant dans
		 * `doli_bdd1`. Renseigné par `scripts/migrations/dolibarr/` quand le
		 * produit est rapproché (référence, EAN) ou créé depuis Dolibarr.
		 * Voir `MIGRATION-DOLIBARR.md`.
		 */
		legacyDoliId: integer('legacy_doli_id'),
		/**
		 * `ps_product.id_category_default` de la source.
		 *
		 * L'arbre PrestaShop n'étant plus importé verbatim (il portait les
		 * nœuds-marques et 93 % de catégories vides), cette valeur est conservée
		 * telle quelle à l'import : c'est elle qui permet à `product-taxonomy` et
		 * `reclassify` d'attribuer la catégorie principale sur l'arbre **propre**,
		 * sans retourner interroger PrestaShop.
		 */
		legacyCategoryPsId: integer('legacy_category_ps_id'),
		/**
		 * Chemin fournisseur d'origine, ex. `KRAMP > Hydraulique > Coupleurs`.
		 *
		 * Le silo KRAMP (480 catégories) n'est pas repris dans l'arbre — c'est une
		 * marque, pas un rangement (§4.1 règle n°5). Mais son libellé est un
		 * **signal de classement plus fiable que le premier mot** : mesuré le
		 * 2026-08-08, il classe 29 956 produits qu'aucune règle n'attrapait.
		 * On le conserve donc pour la traçabilité et le palier 4.
		 */
		supplierCategoryPath: text('supplier_category_path'),

		// Dates
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		/** Dernière modification du prix. */
		priceUpdatedAt: timestamp('price_updated_at', { withTimezone: true })
	},
	(t) => [
		// Non-uniques : la source PrestaShop contient des slugs et références en
		// doublon (~247k). L'unicité stricte casserait l'import.
		index('product_slug_idx').on(t.slug),
		index('product_reference_idx').on(t.reference),
		index('product_brand_idx').on(t.brandId),
		index('product_category_idx').on(t.categoryId),
		// Jointure de résolution pendant la migration : `product-taxonomy` et
		// `reclassify` rattachent les produits par cette clé sur 1,05 M de lignes.
		index('product_legacy_category_idx').on(t.legacyCategoryPsId),
		// La boutique sépare pièces et machines sur presque toutes ses vues :
		// sans index, chaque filtre scannerait les 1,3 M de produits.
		index('product_type_idx').on(t.type),
		// Tri par défaut de la liste admin : sans index, Postgres parcourt les
		// 1,3 M de produits à chaque page.
		index('product_created_at_idx').on(t.createdAt),
		// Index trigram (pg_trgm) : les filtres admin font des ILIKE '%terme%',
		// qu'un btree ne peut pas servir — sans eux, chaque recherche scanne 1,3 M de lignes.
		index('product_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
		index('product_reference_trgm_idx').using('gin', t.reference.op('gin_trgm_ops')),
		index('product_supplier_ref_trgm_idx').using('gin', t.supplierReference.op('gin_trgm_ops')),
		index('product_ean13_trgm_idx').using('gin', t.ean13.op('gin_trgm_ops')),
		index('product_supplier_idx').on(t.supplierId),
		// Reprise Dolibarr : un produit Dolibarr ne se rattache qu'à une fiche.
		uniqueIndex('product_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

/**
 * Conditions d'un fournisseur pour un produit (CDC 11) : référence chez lui,
 * prix d'achat négocié HT, délai, quantité minimale. Un produit peut avoir
 * plusieurs fournisseurs (R1) ; le principal est `product.supplier_id` (R2).
 * La même référence peut désigner deux produits chez deux fournisseurs (R8).
 */
export const supplierProduct = pgTable(
	'supplier_product',
	{
		id: serial('id').primaryKey(),
		supplierId: integer('supplier_id')
			.notNull()
			.references(() => supplier.id, { onDelete: 'restrict' }),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		supplierReference: text('supplier_reference'),
		/** Désignation du produit chez le fournisseur (conditionnement, caractéristiques). */
		description: text('description'),
		purchasePrice: numeric('purchase_price', { precision: 12, scale: 4 }),
		deliveryDays: integer('delivery_days'),
		minQuantity: integer('min_quantity'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('supplier_product_pair_idx').on(t.supplierId, t.productId),
		index('supplier_product_product_idx').on(t.productId)
	]
);

// ---------------------------------------------------------------------------
// Variantes (déclinaisons) — attributs libres en JSON, ex. {"Pointure":"39"}
// ---------------------------------------------------------------------------

export const productVariant = pgTable(
	'product_variant',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),

		name: text('name').notNull(),
		/** Attributs de la variante, ex. {"Pointure":"39","Couleur":"Noir"}. */
		attributes: jsonb('attributes').$type<Record<string, string>>(),
		reference: text('reference'),
		ean13: varchar('ean13', { length: 13 }),
		/** Impact sur le prix HT (delta appliqué au prix du produit). */
		priceImpact: numeric('price_impact', { precision: 12, scale: 4 }).notNull().default('0'),
		/** Impact sur le poids (kg). */
		weightImpact: numeric('weight_impact', { precision: 10, scale: 3 }).notNull().default('0'),
		stock: integer('stock').notNull().default(0),
		imageUrl: text('image_url'),
		isDefault: boolean('is_default').notNull().default(false),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('product_variant_product_idx').on(t.productId)]
);

// ---------------------------------------------------------------------------
// Caractéristiques techniques
// ---------------------------------------------------------------------------

/**
 * Caractéristiques d'un produit, extraites des tableaux HTML des descriptions
 * reprises de PrestaShop (voir `scripts/extract-product-specs.ts`).
 *
 * Elles rendent le catalogue filtrable sur ses critères réels — diamètre,
 * matériau, type de roulement — là où la description ne permettait qu'une
 * lecture. `value_num` et `unit` isolent la partie numérique quand elle
 * existe, ce qui autorise les filtres par plage et non seulement par égalité.
 *
 * À ne pas confondre avec `product_attribute` (section 11 du cahier des
 * charges), qui caractérise les déclinaisons d'un produit.
 */
export const productSpec = pgTable(
	'product_spec',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),

		/** Libellé normalisé, servant de clé de regroupement des facettes. */
		name: text('name').notNull(),
		/** Valeur affichée telle quelle sur la fiche produit. */
		value: text('value').notNull(),
		/** Partie numérique isolée, si la valeur en comporte une. */
		valueNum: numeric('value_num', { precision: 14, scale: 4 }),
		/** Unité accompagnant la valeur numérique (« mm », « kg », « V »…). */
		unit: text('unit'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('product_spec_product_idx').on(t.productId),
		// Facettes : on interroge par libellé puis par valeur.
		index('product_spec_name_value_idx').on(t.name, t.value),
		// Filtres par plage sur les caractéristiques numériques.
		index('product_spec_name_num_idx').on(t.name, t.valueNum),
		// Rend l'import rejouable : une seconde passe met à jour au lieu de dupliquer.
		uniqueIndex('product_spec_unique_idx').on(t.productId, t.name)
	]
);

// ---------------------------------------------------------------------------
// Emplacements de stock — reprise de Dolibarr
// ---------------------------------------------------------------------------

/**
 * Emplacement physique : magasin, atelier, grenier, puis partie et étagère.
 *
 * Reprise Dolibarr : `llx_entrepot` (375 emplacements au 27/10/2026),
 * arborescence par `fk_parent`. Dans Dolibarr, le module sur mesure « UTILE »
 * gérait les entrées, sorties et déplacements entre ces emplacements ; MSShop
 * les reprend sur ses propres produits (voir `MIGRATION-DOLIBARR.md`).
 */
export const stockLocation = pgTable(
	'stock_location',
	{
		id: serial('id').primaryKey(),
		/** Libellé court du nœud, ex. « Étagère 41 » (le chemin complet se déduit des parents). */
		name: text('name').notNull(),
		/**
		 * Code affiché et saisi au magasin, ex. « 41 » (`llx_entrepot.ref`).
		 * Unique, sans tenir compte de la casse : il désigne un seul emplacement.
		 */
		code: text('code'),
		/**
		 * Description, affichée au survol du code comme dans Dolibarr.
		 * Reprise : `llx_entrepot.lieu`, ex. « MAGASIN PIECES DETACHEES / PARTIE DROITE / ETAGERE 43 ».
		 */
		description: text('description'),
		parentId: integer('parent_id').references((): AnyPgColumn => stockLocation.id, {
			onDelete: 'restrict'
		}),
		position: integer('position').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		/**
		 * Emplacement de vente (le MAGASIN) : un produit qui y est rangé, ou dans
		 * un sous-emplacement, porte son prix TTC sur l'étiquette.
		 */
		priceOnLabel: boolean('price_on_label').notNull().default(false),

		/** Reprise Dolibarr : `llx_entrepot.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('stock_location_parent_idx').on(t.parentId),
		uniqueIndex('stock_location_code_idx')
			.on(sql`upper(trim(${t.code}))`)
			.where(sql`${t.code} IS NOT NULL`),
		uniqueIndex('stock_location_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

/**
 * Quantité d'un produit dans un emplacement.
 *
 * Reprise Dolibarr : `llx_product_stock` (`fk_product`, `fk_entrepot`, `reel`).
 * Règle : `product.stock` est la somme des quantités de ses emplacements, dès
 * qu'un produit en a. Le stock reste un seul chiffre, partagé par la boutique,
 * l'atelier et le magasin.
 */
export const productStock = pgTable(
	'product_stock',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		locationId: integer('location_id')
			.notNull()
			.references(() => stockLocation.id, { onDelete: 'restrict' }),
		/** État : neuf, occasion ou garantie (`stockCondition`, UTILE `utile_type_stock`). */
		condition: text('condition').notNull().default('new'),
		quantity: integer('quantity').notNull().default(0),

		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('product_stock_product_location_condition_idx').on(
			t.productId,
			t.locationId,
			t.condition
		),
		index('product_stock_location_idx').on(t.locationId)
	]
);

/**
 * État d'un stock, repris du module Dolibarr « UTILE » (types 1, 2, 3) : le
 * stock d'un emplacement se répartit entre neuf, occasion et garantie.
 */
export const stockCondition = ['new', 'used', 'warranty'] as const;
export type StockCondition = (typeof stockCondition)[number];

/**
 * Numéro de série d'une unité en stock (Dolibarr : `llx_product_batch`).
 * `locationId` null : l'unité est sortie du stock (vendue, posée sur une machine).
 */
export const stockSerial = pgTable(
	'stock_serial',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		serialNumber: text('serial_number').notNull(),
		locationId: integer('location_id').references(() => stockLocation.id, {
			onDelete: 'restrict'
		}),
		condition: text('condition').notNull().default('new'),
		/** Reprise Dolibarr : `llx_product_batch.rowid`. */
		legacyDoliId: integer('legacy_doli_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('stock_serial_product_serial_idx').on(t.productId, sql`upper(${t.serialNumber})`),
		index('stock_serial_location_idx').on(t.locationId),
		uniqueIndex('stock_serial_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

export type StockSerial = typeof stockSerial.$inferSelect;

// ---------------------------------------------------------------------------
// Mouvements de stock (inventory) — historique traçable
// ---------------------------------------------------------------------------

/**
 * Nature d'un mouvement de stock.
 *
 * Reprise Dolibarr (module « UTILE ») : un bon de livraison fournisseur
 * devient une entrée `in`, un bon de sortie une sortie `out`, un déplacement
 * entre étagères un `transfer`.
 */
export const stockMovementType = [
	'in', // entrée (réapprovisionnement, réception fournisseur)
	'out', // sortie manuelle
	'adjustment', // ajustement d'inventaire (correction)
	'order', // décrément suite à une commande
	'return', // incrément suite à un retour
	'repair', // pièce consommée sur un ordre de réparation (CDC 31, R6/R7)
	'transfer', // déplacement d'un emplacement à un autre, stock total inchangé
	'sale' // pièce vendue au comptoir, sortie depuis sa facture
] as const;
export type StockMovementType = (typeof stockMovementType)[number];

/**
 * Bon de stock, repris du module Dolibarr « UTILE » : un bon d'entrée
 * (réception fournisseur, avec son n° de BL) ou un bon de sortie (avec son
 * motif). Il regroupe les mouvements saisis ensemble et s'annule d'un bloc.
 */
export const stockVoucherKind = ['receipt', 'issue'] as const;
export type StockVoucherKind = (typeof stockVoucherKind)[number];

/** Motifs de sortie d'UTILE (`utile_bon_sortie.designation`). */
export const stockIssueReason = ['normal', 'consumable', 'investment'] as const;
export type StockIssueReason = (typeof stockIssueReason)[number];

export const stockVoucher = pgTable(
	'stock_voucher',
	{
		id: serial('id').primaryKey(),
		kind: text('kind').notNull(),
		/** N° du BL fournisseur (entrée) ou du bon (sortie). */
		reference: text('reference'),
		/** Fournisseur du BL, tel que saisi (UTILE : `marque`). */
		supplier: text('supplier'),
		/** Fournisseur du BL, quand il est connu. */
		supplierId: integer('supplier_id').references(() => supplier.id, { onDelete: 'set null' }),
		/** Motif d'une sortie (`stockIssueReason`). */
		reason: text('reason'),
		note: text('note'),
		createdBy: text('created_by'),
		cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
		/** Reprise Dolibarr : « bl:<clé> » ou « bs:<clé> » (clé = horodatage du bon). */
		legacyDoliKey: text('legacy_doli_key'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('stock_voucher_kind_created_idx').on(t.kind, t.createdAt),
		uniqueIndex('stock_voucher_legacy_doli_key_idx')
			.on(t.legacyDoliKey)
			.where(sql`${t.legacyDoliKey} IS NOT NULL`)
	]
);

export type StockVoucher = typeof stockVoucher.$inferSelect;

export const stockMovement = pgTable(
	'stock_movement',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		/** Variante concernée (null = produit simple). */
		variantId: integer('variant_id').references(() => productVariant.id, { onDelete: 'cascade' }),
		/** Quantité du mouvement (positive = entrée, négative = sortie). */
		quantity: integer('quantity').notNull(),
		type: text('type').notNull(),
		/** Emplacement concerné (null = mouvement d'avant les emplacements). */
		locationId: integer('location_id').references(() => stockLocation.id, {
			onDelete: 'set null'
		}),
		/** Pièce justificative : n° de BL fournisseur, n° de bon… (reprise Dolibarr). */
		reference: text('reference'),
		/** État du stock concerné (`stockCondition`). */
		condition: text('condition').notNull().default('new'),
		/** Numéro de série de l'unité, quand le produit en a un. */
		serialNumber: text('serial_number'),
		/** Bon d'entrée ou de sortie qui regroupe ce mouvement. */
		voucherId: integer('voucher_id').references(() => stockVoucher.id, { onDelete: 'set null' }),
		/** Reprise Dolibarr : « bl:<id> » ou « bs:<id> » (ligne de bon UTILE). */
		legacyDoliId: text('legacy_doli_id'),
		note: text('note'),
		/** Utilisateur à l'origine du mouvement (id better-auth), si applicable. */
		createdBy: text('created_by'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('stock_movement_product_idx').on(t.productId),
		index('stock_movement_variant_idx').on(t.variantId),
		index('stock_movement_location_idx').on(t.locationId),
		index('stock_movement_voucher_idx').on(t.voucherId),
		uniqueIndex('stock_movement_legacy_doli_id_idx')
			.on(t.legacyDoliId)
			.where(sql`${t.legacyDoliId} IS NOT NULL`)
	]
);

// ---------------------------------------------------------------------------
// Médias (images, vidéos, PDF de vue éclatée) — ordonnés
// ---------------------------------------------------------------------------

/** Types de média supportés. */
export const productMediaType = ['image', 'video', 'pdf'] as const;
export type ProductMediaType = (typeof productMediaType)[number];

export const productMedia = pgTable(
	'product_media',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),

		type: text('type').notNull().default('image'),
		url: text('url').notNull(),
		alt: text('alt'),
		position: integer('position').notNull().default(0),

		legacyPsId: integer('legacy_ps_id'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('product_media_product_idx').on(t.productId),
		// Contrainte unique pour ON CONFLICT lors de la migration (idempotence)
		// Doit être un uniqueIndex (partial) car legacy_ps_id peut être NULL pour les médias créés après migration
		uniqueIndex('product_media_legacy_unique_idx')
			.on(t.legacyPsId)
			.where(sql`legacy_ps_id IS NOT NULL`)
	]
);

// ---------------------------------------------------------------------------
// Relations produit ↔ produit (remplacement, alternatifs)
// ---------------------------------------------------------------------------

/** Types de relation entre produits. */
export const productRelationType = ['replacement', 'alternative'] as const;
export type ProductRelationType = (typeof productRelationType)[number];

export const productRelation = pgTable(
	'product_relation',
	{
		id: serial('id').primaryKey(),
		/** Produit source (celui affiché). */
		fromProductId: integer('from_product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		/** Produit lié (remplaçant ou alternatif). */
		toProductId: integer('to_product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		position: integer('position').notNull().default(0)
	},
	(t) => [
		index('product_relation_from_idx').on(t.fromProductId),
		uniqueIndex('product_relation_unique_idx').on(t.fromProductId, t.toProductId, t.type)
	]
);

// ---------------------------------------------------------------------------
// Produit ↔ catégories additionnelles (N-N)
// ---------------------------------------------------------------------------

export const productCategory = pgTable(
	'product_category',
	{
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => category.id, { onDelete: 'cascade' })
	},
	(t) => [uniqueIndex('product_category_unique_idx').on(t.productId, t.categoryId)]
);

// ---------------------------------------------------------------------------
// Relations Drizzle (API relationnelle)
// ---------------------------------------------------------------------------

export const brandRelations = relations(brand, ({ many }) => ({
	products: many(product)
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
	parent: one(category, {
		fields: [category.parentId],
		references: [category.id],
		relationName: 'category_tree'
	}),
	children: many(category, { relationName: 'category_tree' }),
	products: many(product)
}));

export const taxRuleRelations = relations(taxRule, ({ many }) => ({
	products: many(product)
}));

export const productRelations = relations(product, ({ one, many }) => ({
	brand: one(brand, { fields: [product.brandId], references: [brand.id] }),
	category: one(category, { fields: [product.categoryId], references: [category.id] }),
	taxRule: one(taxRule, { fields: [product.taxRuleId], references: [taxRule.id] }),
	variants: many(productVariant),
	media: many(productMedia),
	movements: many(stockMovement),
	additionalCategories: many(productCategory)
}));

export const stockLocationRelations = relations(stockLocation, ({ one, many }) => ({
	parent: one(stockLocation, {
		fields: [stockLocation.parentId],
		references: [stockLocation.id],
		relationName: 'stockLocationParent'
	}),
	children: many(stockLocation, { relationName: 'stockLocationParent' }),
	stocks: many(productStock)
}));

export const productStockRelations = relations(productStock, ({ one }) => ({
	product: one(product, { fields: [productStock.productId], references: [product.id] }),
	location: one(stockLocation, {
		fields: [productStock.locationId],
		references: [stockLocation.id]
	})
}));

export const stockMovementRelations = relations(stockMovement, ({ one }) => ({
	product: one(product, { fields: [stockMovement.productId], references: [product.id] }),
	variant: one(productVariant, {
		fields: [stockMovement.variantId],
		references: [productVariant.id]
	}),
	location: one(stockLocation, {
		fields: [stockMovement.locationId],
		references: [stockLocation.id]
	})
}));

export const productVariantRelations = relations(productVariant, ({ one }) => ({
	product: one(product, { fields: [productVariant.productId], references: [product.id] })
}));

export const productMediaRelations = relations(productMedia, ({ one }) => ({
	product: one(product, { fields: [productMedia.productId], references: [product.id] })
}));

export const productCategoryRelations = relations(productCategory, ({ one }) => ({
	product: one(product, { fields: [productCategory.productId], references: [product.id] }),
	category: one(category, { fields: [productCategory.categoryId], references: [category.id] })
}));

// ---------------------------------------------------------------------------
// Types inférés
// ---------------------------------------------------------------------------

export type Brand = typeof brand.$inferSelect;
export type Supplier = typeof supplier.$inferSelect;
export type SupplierProduct = typeof supplierProduct.$inferSelect;
export type NewBrand = typeof brand.$inferInsert;
export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductVariant = typeof productVariant.$inferSelect;
export type NewProductVariant = typeof productVariant.$inferInsert;
export type ProductMedia = typeof productMedia.$inferSelect;
export type NewProductMedia = typeof productMedia.$inferInsert;
export type ProductRelation = typeof productRelation.$inferSelect;
export type NewProductRelation = typeof productRelation.$inferInsert;
export type TaxRule = typeof taxRule.$inferSelect;
export type NewTaxRule = typeof taxRule.$inferInsert;
export type ProductSpec = typeof productSpec.$inferSelect;
export type NewProductSpec = typeof productSpec.$inferInsert;
export type StockLocation = typeof stockLocation.$inferSelect;
export type NewStockLocation = typeof stockLocation.$inferInsert;
export type ProductStock = typeof productStock.$inferSelect;
export type StockMovement = typeof stockMovement.$inferSelect;
export type NewStockMovement = typeof stockMovement.$inferInsert;

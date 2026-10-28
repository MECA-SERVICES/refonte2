-- Fondations du remplacement de Dolibarr (MIGRATION-DOLIBARR.md, § 0 « Un seul
-- système »). Les fonctions de Dolibarr se branchent sur les produits et les
-- clients existants : aucune table ne les recopie à côté.
--
-- Migration additive : aucune donnée existante n'est modifiée ni supprimée.

-- 1. Client sans compte web (client du comptoir). Reprise Dolibarr : sur les
--    423 tiers facturés, 183 n'ont ni e-mail ni SIRET. Le compte better-auth
--    et l'e-mail deviennent facultatifs ; un client avec compte garde les deux.
ALTER TABLE "customer" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "customer" ALTER COLUMN "email" DROP NOT NULL;

-- 2. Traçabilité de la reprise Dolibarr (`doli_bdd1`), comme `legacy_ps_id`
--    pour PrestaShop : `llx_societe.rowid` et `llx_product.rowid`.
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "legacy_doli_id" integer;
CREATE UNIQUE INDEX IF NOT EXISTS "customer_legacy_doli_id_idx"
	ON "customer" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "legacy_doli_id" integer;
CREATE UNIQUE INDEX IF NOT EXISTS "product_legacy_doli_id_idx"
	ON "product" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

-- 3. Emplacements de stock, repris de Dolibarr (`llx_entrepot`, 375 nœuds :
--    magasin, atelier, grenier, parties et étagères).
CREATE TABLE IF NOT EXISTS "stock_location" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"parent_id" integer REFERENCES "stock_location"("id") ON DELETE RESTRICT,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "stock_location_parent_idx" ON "stock_location" ("parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_location_legacy_doli_id_idx"
	ON "stock_location" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

-- 4. Quantité d'un produit par emplacement (Dolibarr : `llx_product_stock`).
--    `product.stock` reste le stock total, somme de ses emplacements.
CREATE TABLE IF NOT EXISTS "product_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL REFERENCES "product"("id") ON DELETE CASCADE,
	"location_id" integer NOT NULL REFERENCES "stock_location"("id") ON DELETE RESTRICT,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_stock_product_location_idx"
	ON "product_stock" ("product_id", "location_id");
CREATE INDEX IF NOT EXISTS "product_stock_location_idx" ON "product_stock" ("location_id");

-- 5. Un mouvement de stock dit de quel emplacement il part ou où il arrive, et
--    porte sa pièce justificative (n° de BL fournisseur, n° de bon), comme les
--    bons d'entrée et de sortie du module Dolibarr « UTILE ».
ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "location_id" integer
	REFERENCES "stock_location"("id") ON DELETE SET NULL;
ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "reference" text;
CREATE INDEX IF NOT EXISTS "stock_movement_location_idx" ON "stock_movement" ("location_id");

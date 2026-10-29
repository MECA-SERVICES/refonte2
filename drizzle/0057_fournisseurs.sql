-- Fournisseurs (CDC 11), repris de PrestaShop (`ps_supplier`, `ps_product_supplier`)
-- et de Dolibarr (tiers fournisseurs, `llx_product_fournisseur_price`).
CREATE TABLE IF NOT EXISTS "supplier" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"email" text,
	"phone" text,
	"line1" text,
	"line2" text,
	"postal_code" text,
	"city" text,
	"country" text DEFAULT 'FR' NOT NULL,
	"siret" text,
	"vat_number" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_ps_id" integer,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_legacy_ps_id_idx" ON "supplier" ("legacy_ps_id") WHERE "legacy_ps_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_legacy_doli_id_idx" ON "supplier" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

-- Conditions d'un fournisseur pour un produit (R1 : plusieurs sources possibles).
-- Le fournisseur principal (R2) est `product.supplier_id`.
CREATE TABLE IF NOT EXISTS "supplier_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL REFERENCES "supplier"("id") ON DELETE RESTRICT,
	"product_id" integer NOT NULL REFERENCES "product"("id") ON DELETE CASCADE,
	"supplier_reference" text,
	"purchase_price" numeric(12, 4),
	"delivery_days" integer,
	"min_quantity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_product_pair_idx" ON "supplier_product" ("supplier_id", "product_id");
CREATE INDEX IF NOT EXISTS "supplier_product_product_idx" ON "supplier_product" ("product_id");

-- `product.supplier_id` portait l'identifiant PrestaShop brut, sans table :
-- la reprise `suppliers` le remplit avec le fournisseur MSShop.
UPDATE "product" SET "supplier_id" = NULL WHERE "supplier_id" IS NOT NULL;
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_supplier_id_supplier_id_fk";
ALTER TABLE "product" ADD CONSTRAINT "product_supplier_id_supplier_id_fk"
	FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "product_supplier_idx" ON "product" ("supplier_id");

-- Fournisseur d'un bon de réception ; `supplier` garde le texte saisi dans UTILE.
ALTER TABLE "stock_voucher" ADD COLUMN IF NOT EXISTS "supplier_id" integer
	REFERENCES "supplier"("id") ON DELETE SET NULL;

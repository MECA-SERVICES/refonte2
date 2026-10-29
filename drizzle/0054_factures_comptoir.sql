-- Factures comptoir, reprises de Dolibarr (`llx_facture`, `llx_facturedet`) :
-- factures et avoirs saisis en back-office, au comptoir ou depuis un ordre de
-- réparation. Numérotation : la série Dolibarr continue (FA2611-1316…,
-- AV2611-0033…), distincte de celle des factures du site.
CREATE SEQUENCE IF NOT EXISTS "counter_invoice_number_seq" START 1316;
CREATE SEQUENCE IF NOT EXISTS "counter_credit_note_number_seq" START 33;

CREATE TABLE IF NOT EXISTS "counter_invoice" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'invoice' NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_id" integer NOT NULL REFERENCES "customer"("id") ON DELETE RESTRICT,
	"repair_order_id" integer REFERENCES "repair_order"("id") ON DELETE SET NULL,
	"credited_invoice_id" integer REFERENCES "counter_invoice"("id") ON DELETE RESTRICT,
	"issued_on" date,
	"billing_address" jsonb,
	"total_ht" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_tva" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_ttc" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_breakdown" jsonb,
	"note" text,
	"private_note" text,
	"abandon_reason" text,
	"created_by" text,
	"validated_by" text,
	"validated_at" timestamp with time zone,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "counter_invoice_number_idx" ON "counter_invoice" ("number") WHERE "number" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "counter_invoice_customer_idx" ON "counter_invoice" ("customer_id");
CREATE INDEX IF NOT EXISTS "counter_invoice_status_idx" ON "counter_invoice" ("kind", "status");
CREATE INDEX IF NOT EXISTS "counter_invoice_repair_idx" ON "counter_invoice" ("repair_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "counter_invoice_legacy_doli_id_idx" ON "counter_invoice" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "counter_invoice_line" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL REFERENCES "counter_invoice"("id") ON DELETE CASCADE,
	"position" integer DEFAULT 0 NOT NULL,
	"product_id" integer REFERENCES "product"("id") ON DELETE SET NULL,
	"label" text NOT NULL,
	"reference" text,
	"quantity" numeric(10, 3) DEFAULT '1' NOT NULL,
	"unit_price_ht" numeric(12, 4) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(6, 3) DEFAULT '20' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_ht" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_tva" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_ttc" numeric(12, 2) DEFAULT '0' NOT NULL,
	"accounting_code" text,
	"legacy_doli_id" integer
);
CREATE INDEX IF NOT EXISTS "counter_invoice_line_invoice_idx" ON "counter_invoice_line" ("invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "counter_invoice_line_legacy_doli_id_idx" ON "counter_invoice_line" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

-- Code comptable de vente du produit (Dolibarr : `accountancy_code_sell`, demande 2.1).
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "accounting_code" text;

-- Règlements : rattachés aussi aux factures comptoir ; ceux repris de Dolibarr
-- sont déjà en banque et n'attendent pas de bordereau.
ALTER TABLE "settlement" ADD COLUMN IF NOT EXISTS "counter_invoice_id" integer
	REFERENCES "counter_invoice"("id") ON DELETE RESTRICT;
ALTER TABLE "settlement" ADD COLUMN IF NOT EXISTS "legacy_doli_id" integer;
CREATE INDEX IF NOT EXISTS "settlement_counter_invoice_idx" ON "settlement" ("counter_invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "settlement_legacy_doli_id_idx" ON "settlement" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

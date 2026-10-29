-- Devis (CDC 23), repris de Dolibarr (`llx_propal`, `llx_propaldet`) : saisis
-- en back-office sur les clients et produits de MSShop, transformables en
-- facture comptoir. Numérotation : la série Dolibarr continue (PR2611-0322…).
CREATE SEQUENCE IF NOT EXISTS "quote_number_seq" START 322;

CREATE TABLE IF NOT EXISTS "quote" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_id" integer NOT NULL REFERENCES "customer"("id") ON DELETE RESTRICT,
	"repair_order_id" integer REFERENCES "repair_order"("id") ON DELETE SET NULL,
	"invoice_id" integer REFERENCES "counter_invoice"("id") ON DELETE SET NULL,
	"issued_on" date,
	"validity_days" integer DEFAULT 15 NOT NULL,
	"valid_until" date,
	"billing_address" jsonb,
	"total_ht" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_tva" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_ttc" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_breakdown" jsonb,
	"note" text,
	"private_note" text,
	"decision_note" text,
	"created_by" text,
	"sent_by" text,
	"sent_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "quote_number_idx" ON "quote" ("number") WHERE "number" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "quote_customer_idx" ON "quote" ("customer_id");
CREATE INDEX IF NOT EXISTS "quote_status_idx" ON "quote" ("status");
CREATE INDEX IF NOT EXISTS "quote_invoice_idx" ON "quote" ("invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quote_legacy_doli_id_idx" ON "quote" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "quote_line" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL REFERENCES "quote"("id") ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS "quote_line_quote_idx" ON "quote_line" ("quote_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quote_line_legacy_doli_id_idx" ON "quote_line" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

-- Crédits des clients (remises de Dolibarr) : acomptes, avoirs, trop-perçus,
-- reprises de machine, remises commerciales ; disponibles ou utilisés.
CREATE TABLE IF NOT EXISTS "customer_credit" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL REFERENCES "customer"("id") ON DELETE RESTRICT,
	"description" text NOT NULL,
	"amount_ht" numeric(12, 2) NOT NULL,
	"amount_tva" numeric(12, 2) NOT NULL,
	"amount_ttc" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(6, 3) NOT NULL,
	"source_invoice_id" integer REFERENCES "counter_invoice"("id") ON DELETE SET NULL,
	"used_line_id" integer REFERENCES "counter_invoice_line"("id") ON DELETE SET NULL,
	"used_invoice_id" integer REFERENCES "counter_invoice"("id") ON DELETE SET NULL,
	"created_by" text,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_credit_customer_idx" ON "customer_credit" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_credit_used_line_idx" ON "customer_credit" ("used_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_credit_legacy_doli_id_idx" ON "customer_credit" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

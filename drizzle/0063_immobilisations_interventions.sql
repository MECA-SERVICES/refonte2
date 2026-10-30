-- Immobilisations (module UTILE de Dolibarr) et rattachement des fiches
-- d'intervention Dolibarr reprises en ordres de réparation.
CREATE TABLE IF NOT EXISTS "fixed_asset" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"usage" text,
	"acquired_on" date,
	"purchase_price" numeric(12, 2),
	"book_value" numeric(12, 2),
	"product_id" integer REFERENCES "product"("id") ON DELETE SET NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_utile_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_asset_usage_idx" ON "fixed_asset" ("usage");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_legacy_utile_id_idx" ON "fixed_asset" ("legacy_utile_id") WHERE "legacy_utile_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "repair_order" ADD COLUMN IF NOT EXISTS "legacy_doli_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "repair_order_legacy_doli_id_idx" ON "repair_order" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

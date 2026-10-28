-- Bons de stock, repris du module Dolibarr « UTILE » : bon d'entrée (réception
-- fournisseur, `utile_bon_livraison`) et bon de sortie (`utile_bon_sortie`).
-- Un bon regroupe les mouvements saisis ensemble ; l'historique Dolibarr est
-- repris en mouvements sans emplacement (UTILE n'en gardait pas).
CREATE TABLE IF NOT EXISTS "stock_voucher" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"reference" text,
	"supplier" text,
	"reason" text,
	"note" text,
	"created_by" text,
	"cancelled_at" timestamp with time zone,
	"legacy_doli_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "stock_voucher_kind_created_idx" ON "stock_voucher" ("kind", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_voucher_legacy_doli_key_idx"
	ON "stock_voucher" ("legacy_doli_key") WHERE "legacy_doli_key" IS NOT NULL;

ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "voucher_id" integer
	REFERENCES "stock_voucher"("id") ON DELETE SET NULL;
ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "legacy_doli_id" text;
CREATE INDEX IF NOT EXISTS "stock_movement_voucher_idx" ON "stock_movement" ("voucher_id");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movement_legacy_doli_id_idx"
	ON "stock_movement" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

-- Reprise Dolibarr, module « UTILE » : état du stock (Neuf / Occasion /
-- Garantie), numéros de série et inventaire annuel. Voir MIGRATION-DOLIBARR.md.

-- 1. État d'un stock : le stock d'un emplacement se répartit par état, comme
--    `utile_type_stock` (type 1 = neuf, 2 = occasion, 3 = garantie).
ALTER TABLE "product_stock" ADD COLUMN IF NOT EXISTS "condition" text DEFAULT 'new' NOT NULL;
DROP INDEX IF EXISTS "product_stock_product_location_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "product_stock_product_location_condition_idx"
	ON "product_stock" ("product_id", "location_id", "condition");

ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "condition" text DEFAULT 'new' NOT NULL;
ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "serial_number" text;

-- 2. Numéros de série des unités en stock (Dolibarr : `llx_product_batch`).
--    `location_id` null : l'unité est sortie du stock (vendue, posée).
CREATE TABLE IF NOT EXISTS "stock_serial" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL REFERENCES "product"("id") ON DELETE CASCADE,
	"serial_number" text NOT NULL,
	"location_id" integer REFERENCES "stock_location"("id") ON DELETE RESTRICT,
	"condition" text DEFAULT 'new' NOT NULL,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_serial_product_serial_idx"
	ON "stock_serial" ("product_id", upper("serial_number"));
CREATE INDEX IF NOT EXISTS "stock_serial_location_idx" ON "stock_serial" ("location_id");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_serial_legacy_doli_id_idx"
	ON "stock_serial" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

-- 3. Inventaire : campagnes (`utile_liste_inventaire`), comptages par produit,
--    emplacement et état (`utile_inventaire` + `utile_type_inv`), numéros de
--    série comptés (`utile_numero_serie`).
CREATE TABLE IF NOT EXISTS "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"validated_at" timestamp with time zone,
	"validated_by" text,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_legacy_doli_id_idx"
	ON "inventory" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "inventory_count" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_id" integer NOT NULL REFERENCES "inventory"("id") ON DELETE CASCADE,
	"product_id" integer NOT NULL REFERENCES "product"("id") ON DELETE CASCADE,
	"location_id" integer NOT NULL REFERENCES "stock_location"("id") ON DELETE RESTRICT,
	"condition" text DEFAULT 'new' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"purchase_price" numeric(12, 4),
	"note" text,
	"counted_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_count_line_idx"
	ON "inventory_count" ("inventory_id", "product_id", "location_id", "condition");
CREATE INDEX IF NOT EXISTS "inventory_count_location_idx" ON "inventory_count" ("location_id");

CREATE TABLE IF NOT EXISTS "inventory_serial" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_count_id" integer NOT NULL REFERENCES "inventory_count"("id") ON DELETE CASCADE,
	"serial_number" text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_serial_line_idx"
	ON "inventory_serial" ("inventory_count_id", upper("serial_number"));

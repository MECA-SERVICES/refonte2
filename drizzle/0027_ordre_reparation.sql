-- Ordres de réparation atelier (CDC 31).

CREATE TABLE IF NOT EXISTS "repair_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"customer_id" integer NOT NULL,
	-- Origine dans la section 30, à venir : pas de clé étrangère tant que les
	-- tables `repair_request` et `quote` n'existent pas.
	"repair_request_id" integer,
	"quote_id" integer,
	"status" text DEFAULT 'to_do' NOT NULL,
	"order_type" text DEFAULT 'paid' NOT NULL,
	"warranty_reference" text,
	"warranty_document_url" text,
	"machine_type" text,
	"machine_brand" text,
	"machine_model" text,
	"serial_number" text,
	"machine_condition" text,
	"engine_model" text,
	"engine_serial_number" text,
	"work_description" text,
	-- R13 : pièce attendue et date prévue lors d'une suspension.
	"on_hold_part_label" text,
	"on_hold_expected_at" timestamp with time zone,
	"diagnostic_fee" numeric(12,2) DEFAULT '0' NOT NULL,
	"labor_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_parts_ht" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_ht" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_tva" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_ttc" numeric(12,2) DEFAULT '0' NOT NULL,
	-- Facturation non branchée : colonne posée pour la section 24.
	"invoice_id" integer,
	"notes" text,
	"private_note" text,
	"machine_added_to_fleet" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"paid_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "repair_order_part" (
	"id" serial PRIMARY KEY NOT NULL,
	"repair_order_id" integer NOT NULL,
	"product_id" integer,
	"part_name" text NOT NULL,
	"part_reference" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_ht" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_ht" numeric(12,2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "repair_order_image" (
	"id" serial PRIMARY KEY NOT NULL,
	"repair_order_id" integer NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"moment" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- `restrict` : un client ayant un historique d'atelier ne se supprime pas
-- silencieusement.
ALTER TABLE "repair_order" ADD CONSTRAINT "repair_order_customer_id_fk"
	FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "repair_order_part" ADD CONSTRAINT "repair_order_part_order_id_fk"
	FOREIGN KEY ("repair_order_id") REFERENCES "repair_order"("id") ON DELETE cascade;--> statement-breakpoint
-- `set null` : retirer un produit du catalogue ne doit pas effacer la trace
-- d'une pièce réellement posée sur une machine.
ALTER TABLE "repair_order_part" ADD CONSTRAINT "repair_order_part_product_id_fk"
	FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "repair_order_image" ADD CONSTRAINT "repair_order_image_order_id_fk"
	FOREIGN KEY ("repair_order_id") REFERENCES "repair_order"("id") ON DELETE cascade;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "repair_order_reference_idx" ON "repair_order" ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repair_order_customer_idx" ON "repair_order" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repair_order_status_idx" ON "repair_order" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repair_order_part_order_idx" ON "repair_order_part" ("repair_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repair_order_image_order_idx" ON "repair_order_image" ("repair_order_id");--> statement-breakpoint

-- Pièces consommées à l'atelier : nouveau type de mouvement de stock (R6/R7).
ALTER TABLE "stock_movement" DROP CONSTRAINT IF EXISTS "stock_movement_type_check";

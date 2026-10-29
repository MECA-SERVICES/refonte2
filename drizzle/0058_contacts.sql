-- Interlocuteurs d'un client pro ou d'un fournisseur, repris de Dolibarr
-- (`llx_socpeople`) : service facturation, commercial, livreur…
CREATE TABLE IF NOT EXISTS "contact" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer REFERENCES "customer"("id") ON DELETE CASCADE,
	"supplier_id" integer REFERENCES "supplier"("id") ON DELETE CASCADE,
	"first_name" text,
	"last_name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"mobile" text,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_owner_check" CHECK (("customer_id" IS NULL) <> ("supplier_id" IS NULL))
);
CREATE INDEX IF NOT EXISTS "contact_customer_idx" ON "contact" ("customer_id");
CREATE INDEX IF NOT EXISTS "contact_supplier_idx" ON "contact" ("supplier_id");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_legacy_doli_id_idx" ON "contact" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

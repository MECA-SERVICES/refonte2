-- Validation des comptes professionnels et collectivités (CDC 08).

CREATE TABLE IF NOT EXISTS "account_validation_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	-- Informations figées telles que soumises : la fiche client évolue, le
	-- dossier examiné doit rester consultable en l'état.
	"submitted_data" jsonb,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"rejection_reason" text,
	-- Demande de complément : le dossier reste `pending`.
	"info_requested_at" timestamp with time zone,
	"info_requested" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "account_validation_request" ADD CONSTRAINT "avr_customer_id_fk"
	FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "account_validation_request" ADD CONSTRAINT "avr_reviewed_by_fk"
	FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE set null;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "avr_status_created_idx" ON "account_validation_request" ("status", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avr_customer_idx" ON "account_validation_request" ("customer_id");--> statement-breakpoint

-- État courant de la décision, porté par la fiche pour éviter une jointure.
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "rejection_reason" text;--> statement-breakpoint

-- Couple `type/status` d'avant la normalisation (migration 0030), conservé pour
-- pouvoir revenir en arrière. Posée ici, avec les autres colonnes : le schéma
-- Drizzle la déclare, donc toute lecture de `customer` la réclame.
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "legacy_account_state" text;

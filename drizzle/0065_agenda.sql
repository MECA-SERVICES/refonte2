-- Agenda de Dolibarr, en archive.
CREATE TABLE IF NOT EXISTS "agenda_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"note" text,
	"customer_id" integer REFERENCES "customer"("id") ON DELETE SET NULL,
	"owner_name" text,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agenda_event_starts_idx" ON "agenda_event" ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agenda_event_legacy_doli_id_idx" ON "agenda_event" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

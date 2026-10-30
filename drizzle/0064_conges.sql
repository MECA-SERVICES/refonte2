-- Congés de l'équipe (module Congés de Dolibarr) : demandes, soldes, journal.
CREATE SEQUENCE IF NOT EXISTS "leave_number_seq" START 1;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"employee_name" text NOT NULL,
	"type" text NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date NOT NULL,
	"starts_afternoon" boolean DEFAULT false NOT NULL,
	"ends_at_noon" boolean DEFAULT false NOT NULL,
	"days" numeric(6, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"decision_note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_request_reference_idx" ON "leave_request" ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_request_user_idx" ON "leave_request" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_request_status_idx" ON "leave_request" ("status", "start_on");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_request_legacy_doli_id_idx" ON "leave_request" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_balance" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"type" text NOT NULL,
	"days" numeric(8, 3) DEFAULT '0' NOT NULL,
	"accrued_through" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_balance_user_type_idx" ON "leave_balance" ("user_id", "type");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_balance_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"employee_name" text NOT NULL,
	"type" text NOT NULL,
	"previous_days" numeric(8, 3),
	"new_days" numeric(8, 3),
	"reason" text NOT NULL,
	"actor_name" text,
	"legacy_doli_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_balance_log_user_idx" ON "leave_balance_log" ("user_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_balance_log_legacy_doli_id_idx" ON "leave_balance_log" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

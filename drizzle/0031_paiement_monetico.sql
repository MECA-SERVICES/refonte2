-- Journal des échanges avec les plateformes de paiement (CDC 20).

CREATE TABLE IF NOT EXISTS "payment_transaction" (
	"id" serial PRIMARY KEY NOT NULL,
	-- Nullable : une notification portant une référence inconnue doit tout de
	-- même être journalisée, c'est le cas qu'on voudra examiner.
	"order_id" integer,
	"provider" text NOT NULL,
	"reference" text,
	"direction" text NOT NULL,
	"raw_payload" text,
	-- Les deux sceaux sont conservés : leur comparaison diagnostique une clé
	-- erronée ou un champ mal assemblé.
	"signature_received" text,
	"signature_expected" text,
	"signature_valid" boolean,
	"return_code" text,
	"refusal_reason" text,
	"auth_number" text,
	"http_status" integer,
	"remote_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_order_id_fk"
	FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE set null;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_transaction_order_idx" ON "payment_transaction" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transaction_reference_idx" ON "payment_transaction" ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transaction_created_idx" ON "payment_transaction" ("created_at");

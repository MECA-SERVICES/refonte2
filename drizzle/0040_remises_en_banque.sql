-- Bordereaux de remise en banque des chèques et des espèces (demande 1.2).
-- Un règlement porté à la banque est rattaché à son bordereau ; tant qu'il
-- est en caisse, `remittance_id` reste nul. Table et colonne nouvelles :
-- aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS "remittance" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"kind" text NOT NULL,
	"bank_account" text NOT NULL,
	"deposited_on" date NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"settlement_count" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "remittance_reference_idx" ON "remittance" ("reference");
ALTER TABLE "settlement" ADD COLUMN IF NOT EXISTS "remittance_id" integer REFERENCES "remittance"("id") ON DELETE set null;
CREATE INDEX IF NOT EXISTS "settlement_remittance_idx" ON "settlement" ("remittance_id");

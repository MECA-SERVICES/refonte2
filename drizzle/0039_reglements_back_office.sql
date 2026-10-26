-- Règlements saisis en back-office (chèque, espèces, carte, virement),
-- rattachés aux ordres de réparation. Les détails du chèque préparent les
-- bordereaux de remise en banque. Table nouvelle : aucune donnée existante
-- n'est modifiée.
CREATE TABLE IF NOT EXISTS "settlement" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"method" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"received_on" date NOT NULL,
	"cheque_number" text,
	"cheque_issuer" text,
	"cheque_bank" text,
	"repair_order_id" integer REFERENCES "repair_order"("id") ON DELETE restrict,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "settlement_reference_idx" ON "settlement" ("reference");
CREATE INDEX IF NOT EXISTS "settlement_repair_order_idx" ON "settlement" ("repair_order_id");
CREATE INDEX IF NOT EXISTS "settlement_method_received_idx" ON "settlement" ("method", "received_on");

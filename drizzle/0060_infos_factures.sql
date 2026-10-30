-- Informations d'une facture comptoir, comme dans Dolibarr : référence du
-- client, conditions et mode de règlement, échéance, compte crédité.
ALTER TABLE "counter_invoice" ADD COLUMN IF NOT EXISTS "customer_reference" text;--> statement-breakpoint
ALTER TABLE "counter_invoice" ADD COLUMN IF NOT EXISTS "payment_terms" text DEFAULT 'receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE "counter_invoice" ADD COLUMN IF NOT EXISTS "due_on" date;--> statement-breakpoint
ALTER TABLE "counter_invoice" ADD COLUMN IF NOT EXISTS "payment_method" text;--> statement-breakpoint
ALTER TABLE "counter_invoice" ADD COLUMN IF NOT EXISTS "bank_account" text DEFAULT 'COMPTE-PRO' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote" ADD COLUMN IF NOT EXISTS "customer_reference" text;--> statement-breakpoint
-- Compte du règlement noté par Dolibarr (COMPTE-PRO, CAISSE).
ALTER TABLE "settlement" ADD COLUMN IF NOT EXISTS "bank_account" text;

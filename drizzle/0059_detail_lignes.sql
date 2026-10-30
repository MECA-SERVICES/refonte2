-- Détail d'une ligne de facture ou de devis, imprimé sous la désignation :
-- n° de série, garantie, caractéristiques (repris de Dolibarr).
ALTER TABLE "counter_invoice_line" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "quote_line" ADD COLUMN IF NOT EXISTS "description" text;

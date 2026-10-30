-- Derniers champs de Dolibarr : alias, site et fax des tiers, informations
-- légales des fournisseurs, civilité des contacts, description du produit
-- chez le fournisseur, date de livraison prévue d'un devis.
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "alias" text;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "website" text;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "fax" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "website" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "fax" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "naf_code" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "rcs" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "share_capital" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN IF NOT EXISTS "civility" text;--> statement-breakpoint
ALTER TABLE "supplier_product" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "quote" ADD COLUMN IF NOT EXISTS "delivery_on" date;

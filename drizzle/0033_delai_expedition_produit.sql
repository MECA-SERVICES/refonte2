-- Messages de délai d'expédition par produit (onglet « Livraison »).
--
-- Deux textes libres plutôt qu'un nombre de jours : l'atelier annonce aussi
-- bien « EXPEDITION SOUS 24H A 48H » que « Nous consulter », et un entier ne
-- saurait porter le second cas.

-- `default` : tant qu'aucun message propre n'est saisi, le produit affiche
-- celui de la boutique — c'est-à-dire exactement ce qui était codé en dur
-- jusqu'ici. Aucun changement visible à la migration.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "delivery_time_mode" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "delivery_time_in_stock" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "delivery_time_out_of_stock" text;

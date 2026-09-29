-- Onglet « Quantités » : ce que l'on détient, et ce que le client doit acheter.
--
-- `stock` répond à « combien en ai-je ? », `min_order_quantity` à « combien
-- doit-on en prendre d'un coup ? ». Les deux étaient confondus jusqu'ici, le
-- second n'existant simplement pas.

-- 1 par défaut : sans minimum déclaré, on achète à l'unité — comportement
-- actuel, donc aucun changement pour les fiches existantes.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "min_order_quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

-- Emplacement physique en atelier (allée, étagère, bac).
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "stock_location" text;--> statement-breakpoint

-- Seuil d'alerte de réappro ; 0 désactive.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "low_stock_threshold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Date de réapprovisionnement annoncée.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "available_date" timestamp with time zone;

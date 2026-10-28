-- Numéros de série des pièces posées lors d'un ordre de réparation : repris
-- de la sortie de stock, la pièce reste ainsi rattachée à la machine réparée.
ALTER TABLE "repair_order_part" ADD COLUMN IF NOT EXISTS "serial_numbers" text[] DEFAULT '{}' NOT NULL;

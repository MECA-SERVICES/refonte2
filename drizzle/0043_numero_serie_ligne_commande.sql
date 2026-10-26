-- Numéro de série des machines vendues, saisi sur la ligne de commande
-- (demande 13.3), et affiché sur la fiche client (13.7). Colonne facultative :
-- aucune donnée existante n'est modifiée.
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "serial_number" text;

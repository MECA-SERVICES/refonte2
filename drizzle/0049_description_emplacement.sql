-- Description d'un emplacement, affichée au survol de son code comme dans
-- Dolibarr. Reprise : `llx_entrepot.lieu` (« MAGASIN PIECES DETACHEES /
-- PARTIE DROITE / ETAGERE 43 / RANGEE 7 / BOITE 2 »), par `migrate:doli`.
ALTER TABLE "stock_location" ADD COLUMN IF NOT EXISTS "description" text;

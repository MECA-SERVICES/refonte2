-- Emplacement de vente : un produit qui y est rangé porte son prix TTC sur
-- l'étiquette (les autres étiquettes n'ont pas de prix). Vaut aussi pour les
-- sous-emplacements. Au départ : le MAGASIN (code 1 dans Dolibarr), seul
-- espace de vente au comptoir.
ALTER TABLE "stock_location" ADD COLUMN IF NOT EXISTS "price_on_label" boolean DEFAULT false NOT NULL;
UPDATE "stock_location" SET "price_on_label" = true
	WHERE "legacy_doli_id" IS NOT NULL AND "code" = '1' AND "parent_id" IS NULL;

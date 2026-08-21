-- Index composite pour optimiser la récupération d'images produits par catégorie
-- Utilisé par getShopMenu() pour afficher les vignettes des catégories
-- CONCURRENTLY pour éviter de bloquer la table

CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_media_category_idx" ON "product_media" USING btree ("type", "product_id", "position");

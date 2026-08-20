-- Index composites pour optimiser les listes de produits publiques
-- is_active est toujours filtré, donc on le met en premier
-- CONCURRENTLY pour éviter de bloquer la table (pas de transaction, une par une)

-- Liste produits actifs triés par date (page d'accueil, "nouveaux produits")
CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_active_created_idx" ON "product" USING btree ("is_active", "created_at" DESC, "id" DESC);--> statement-breakpoint

-- Liste produits actifs triés par prix
CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_active_price_idx" ON "product" USING btree ("is_active", "price_ht");--> statement-breakpoint

-- Liste produits actifs par catégorie (requête très fréquente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_active_category_idx" ON "product" USING btree ("is_active", "category_id");--> statement-breakpoint

-- Table de liaison product_category pour les catégories multiples
CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_category_composite_idx" ON "product_category" USING btree ("category_id", "product_id");

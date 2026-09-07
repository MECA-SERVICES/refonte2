-- Index de couverture des facettes du catalogue.
--
-- Les compteurs par marque et par disponibilité agrégeaient jusqu'à 959 000
-- lignes avec un tri sur disque (7 s par requête). Cet index les ramène sous
-- les 300 ms : il porte la catégorie et la marque, embarque le stock pour
-- éviter le retour à la table, et ne couvre que les produits actifs.
--
-- CONCURRENTLY : à exécuter hors transaction. Cette migration doit donc être
-- appliquée à la main (voir 0015), drizzle-kit enveloppant chaque fichier.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_facets_idx"
  ON "product" ("category_id", "brand_id") INCLUDE ("stock") WHERE "is_active";

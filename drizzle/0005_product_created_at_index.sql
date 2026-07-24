-- Tri par défaut de la liste admin des produits (ORDER BY created_at DESC).
-- Sans cet index, Postgres parcourt les 1,3 M de lignes à chaque page (~500 ms).
CREATE INDEX "product_created_at_idx" ON "product" USING btree ("created_at");

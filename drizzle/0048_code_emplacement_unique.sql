-- Un code d'emplacement (le numéro de l'étiquette, ex. « 4372 ») désigne un
-- seul emplacement : sinon le sélecteur et les mouvements de stock pourraient
-- viser le mauvais. Insensible à la casse et aux espaces autour ; un
-- emplacement sans code reste possible.
CREATE UNIQUE INDEX IF NOT EXISTS "stock_location_code_idx"
	ON "stock_location" (upper(trim("code"))) WHERE "code" IS NOT NULL;

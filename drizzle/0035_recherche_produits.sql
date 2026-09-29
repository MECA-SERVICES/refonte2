-- Recherche produits tolérante aux fautes (CDC recherche).
--
-- Un index trigramme sur une expression — nom + références + EAN, en
-- minuscules et sans accents — sert à la fois la sous-chaîne (`LIKE '%…%'`)
-- et la proximité orthographique (`<%`, word_similarity). L'expression est
-- indexée telle quelle plutôt que stockée en colonne : pas de réécriture du
-- million de lignes de `product`, et le code SQL reproduit l'expression à
-- l'identique pour bénéficier de l'index (cf. `$lib/server/search.ts`).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
-- `unaccent` n'est pas IMMUTABLE (son dictionnaire peut changer) : ce
-- wrapper fige le dictionnaire par défaut, condition pour l'indexer.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_search_trgm_idx" ON "product"
USING gin (
	f_unaccent(lower(
		"name" || ' ' || coalesce("reference", '') || ' ' ||
		coalesce("supplier_reference", '') || ' ' || coalesce("ean13", '')
	)) gin_trgm_ops
)
WHERE "is_active" = true;
--> statement-breakpoint
-- Seuil de l'opérateur `<%` (0,6 par défaut, trop strict pour une faute de
-- frappe) : posé au niveau de la base pour que chaque connexion l'hérite.
DO $$
BEGIN
	EXECUTE format('ALTER DATABASE %I SET pg_trgm.word_similarity_threshold = 0.35', current_database());
END $$;

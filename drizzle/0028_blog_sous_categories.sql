-- Sous-catégories du blog (CDC 33) : arborescence jusqu'à trois niveaux.

ALTER TABLE "blog_category" ADD COLUMN IF NOT EXISTS "parent_id" integer;--> statement-breakpoint

-- `set null` : supprimer un parent remonte ses enfants à la racine plutôt que
-- de bloquer. R15 protège déjà, plus haut, les catégories portant des articles.
ALTER TABLE "blog_category" ADD CONSTRAINT "blog_category_parent_id_fk"
	FOREIGN KEY ("parent_id") REFERENCES "blog_category"("id") ON DELETE set null;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "blog_category_parent_idx" ON "blog_category" ("parent_id");

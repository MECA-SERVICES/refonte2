-- Responsable par défaut d'une catégorie de messages (demande 13.9) : une
-- demande client ouverte dans cette catégorie lui est assignée d'office.
-- Colonne facultative : aucune donnée existante n'est modifiée.
ALTER TABLE "support_category" ADD COLUMN IF NOT EXISTS "default_assignee_user_id" text REFERENCES "user"("id") ON DELETE set null;

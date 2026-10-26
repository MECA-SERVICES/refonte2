-- Étiquette d'atelier sur les ordres de réparation : numéro de l'étiquette
-- posée sur la machine à sa prise en charge. Champ libre, modifiable à tout
-- moment, affiché dans la file des travaux et cherchable.
ALTER TABLE "repair_order" ADD COLUMN IF NOT EXISTS "workshop_label" text;

-- Délai d'expédition annoncé au client, figé sur la commande au moment de la
-- passer (demande 12.3) : message retenu et fenêtre de dates estimée.
-- Colonnes facultatives : aucune donnée existante n'est modifiée.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_delay" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_estimate_from" date;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_estimate_to" date;

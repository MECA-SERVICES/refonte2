-- Facturation (CDC 24) : numérotation légale et ventilation de TVA.

-- Ventilation par taux, telle qu'imprimée sur le document. Figée à l'émission :
-- une facture émise ne se recalcule pas (R4).
ALTER TABLE "order_invoice" ADD COLUMN IF NOT EXISTS "tax_breakdown" jsonb;--> statement-breakpoint

-- Régime fiscal et mention légale associée (R7), figés eux aussi : le statut du
-- client peut changer plus tard, la facture ne bouge pas.
ALTER TABLE "order_invoice" ADD COLUMN IF NOT EXISTS "tax_regime" text;--> statement-breakpoint
ALTER TABLE "order_invoice" ADD COLUMN IF NOT EXISTS "tax_mention" text;--> statement-breakpoint

-- Date d'émission distincte de created_at : l'import a repris des factures de
-- 2014, dont la date d'émission n'est pas la date d'insertion en base.
ALTER TABLE "order_invoice" ADD COLUMN IF NOT EXISTS "issued_at" timestamp with time zone;--> statement-breakpoint
UPDATE "order_invoice" SET "issued_at" = "created_at" WHERE "issued_at" IS NULL;--> statement-breakpoint

-- R1/R2 : un numéro ne peut jamais être réutilisé ni dupliqué.
CREATE UNIQUE INDEX IF NOT EXISTS "order_invoice_number_unique" ON "order_invoice" ("number");--> statement-breakpoint

-- Séquence de numérotation.
--
-- Postgres garantit l'unicité même sous accès concurrent, là où un
-- « SELECT max(number) + 1 » applicatif produirait des doublons.
--
-- La valeur de départ est posée par le script de calage, à partir du dernier
-- numéro réellement émis par PrestaShop — qui dépasse le plus grand numéro
-- migré. Démarrer sur le max en base réémettrait des numéros déjà utilisés.
CREATE SEQUENCE IF NOT EXISTS "order_invoice_number_seq" AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

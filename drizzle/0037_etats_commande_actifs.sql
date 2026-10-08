-- États de commande activables : un état inactif n'est plus proposé lors du
-- changement d'état d'une commande, mais reste affiché sur les commandes qui
-- le portent déjà. Tous les états existants restent actifs.
ALTER TABLE "order_state" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

-- Historique des états des ordres de réparation (demande 13.8). Table
-- nouvelle ; les ordres existants reçoivent un historique reconstitué à partir
-- de leurs horodatages (création, démarrage, achèvement, restitution).
CREATE TABLE IF NOT EXISTS "repair_order_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"repair_order_id" integer NOT NULL REFERENCES "repair_order"("id") ON DELETE cascade,
	"status" text NOT NULL,
	"note" text,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "repair_order_history_order_idx" ON "repair_order_history" ("repair_order_id");

INSERT INTO "repair_order_history" ("repair_order_id", "status", "note", "created_at")
SELECT o.id, s.status, 'Reconstitué depuis les dates de l''ordre', s.at
FROM "repair_order" o
CROSS JOIN LATERAL (VALUES
	('to_do', o.created_at),
	('in_progress', o.started_at),
	('completed', o.completed_at),
	('delivered', o.delivered_at)
) AS s(status, at)
WHERE s.at IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "repair_order_history" h WHERE h.repair_order_id = o.id);

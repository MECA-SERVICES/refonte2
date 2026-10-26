-- Types de matériel gérés en back-office (demande 4.3), jusqu'ici figés dans
-- le code. La table est amorcée avec les douze types existants, dans le même
-- ordre. Les fiches (parc client, ordres de réparation) gardent leur libellé
-- en texte : aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS "equipment_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_type_name_idx" ON "equipment_type" (lower("name"));
INSERT INTO "equipment_type" ("name", "position") VALUES
	('Tondeuse', 10),
	('Tracteur tondeuse', 20),
	('Robot de tonte', 30),
	('Débroussailleuse', 40),
	('Tronçonneuse', 50),
	('Taille-haie', 60),
	('Souffleur', 70),
	('Motoculteur', 80),
	('Nettoyeur haute pression', 90),
	('Broyeur', 100),
	('Groupe électrogène', 110),
	('Autre', 120)
ON CONFLICT DO NOTHING;

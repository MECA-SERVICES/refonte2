-- Normalisation du vocabulaire des comptes clients (CDC 08).
--
-- Trois jeux de valeurs coexistaient sur `customer.type` et `customer.status` :
-- la reprise PrestaShop (`individual`/`professional`, `active`/`inactive`), une
-- première version du schéma (`entreprise`) et le CDC (`pro`, `pending`/
-- `validated`/`rejected`). Cette migration ramène tout au vocabulaire du CDC.
--
-- Conserve l'ancienne valeur dans `legacy_account_state` (colonne posée par la
-- migration 0029) : la bascule des professionnels vers `pending` leur retire
-- les conditions professionnelles, et il faut pouvoir revenir en arrière.

-- Sauvegarde de l'état d'origine, une seule fois (relance sans effet).
UPDATE "customer"
SET "legacy_account_state" = "type" || '/' || "status"
WHERE "legacy_account_state" IS NULL;--> statement-breakpoint

-- Types : vers `particulier`, `pro`, `collectivite`.
UPDATE "customer" SET "type" = 'particulier' WHERE "type" IN ('individual', 'particulier');--> statement-breakpoint
UPDATE "customer" SET "type" = 'pro' WHERE "type" IN ('professional', 'entreprise', 'company');--> statement-breakpoint
UPDATE "customer" SET "type" = 'collectivite' WHERE "type" IN ('collectivity', 'collectivite');--> statement-breakpoint

-- Statuts : un particulier est validé d'office (R1).
UPDATE "customer" SET "status" = 'validated' WHERE "type" = 'particulier';--> statement-breakpoint

-- Professionnels et collectivités repris : dossier à examiner (R2).
-- Les comptes déjà refusés le restent.
UPDATE "customer"
SET "status" = 'rejected'
WHERE "type" <> 'particulier' AND "status" IN ('inactive', 'rejected');--> statement-breakpoint

UPDATE "customer"
SET "status" = 'pending'
WHERE "type" <> 'particulier' AND "status" NOT IN ('rejected');--> statement-breakpoint

-- Ouvre une demande pour chaque dossier en attente, afin qu'il apparaisse dans
-- la file du back-office. `submitted_data` reprend ce que porte la fiche.
INSERT INTO "account_validation_request"
	("customer_id", "request_type", "status", "submitted_data", "created_at", "updated_at")
SELECT
	c."id",
	c."type",
	'pending',
	jsonb_build_object(
		'companyName', c."company_name",
		'siret', c."siret",
		'vatNumber', c."vat_number",
		'collectivityType', c."collectivity_type",
		'collectivityName', c."collectivity_name",
		'origin', 'reprise'
	),
	c."created_at",
	now()
FROM "customer" c
WHERE c."type" <> 'particulier'
	AND c."status" = 'pending'
	-- Idempotence : ne pas doubler une demande déjà ouverte.
	AND NOT EXISTS (
		SELECT 1 FROM "account_validation_request" r
		WHERE r."customer_id" = c."id" AND r."status" = 'pending'
	);

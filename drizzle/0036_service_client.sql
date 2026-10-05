-- Service client (CDC 27) : conversations, messages, pièces jointes, catégories.
--
-- Deux familles de tables :
--
--  - `support_*` : le système vivant, où l'équipe et les clients écrivent ;
--  - `legacy_support_*` : l'historique repris de PrestaShop (module
--    wkhelpdesk, SAV natif, commentaires de commande), en lecture seule.
--
-- Les deux partagent les mêmes séquences d'identifiants : un numéro de
-- conversation ou de message est unique quelle que soit sa table. Les vues
-- `support_thread_all` et `support_message_all` les réunissent, et l'écran
-- n'a jamais à savoir d'où vient une conversation.

-- ---------------------------------------------------------------------------
-- Catégories, gérées depuis le back-office
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "support_category" (
	"id" serial PRIMARY KEY NOT NULL,
	-- Code stable, sert à la reprise et aux filtres d'URL.
	"code" text NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	-- Une catégorie déjà utilisée se désactive : la supprimer orphelinerait
	-- les conversations qui la portent.
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_category_code_idx" ON "support_category" ("code");--> statement-breakpoint

-- Les six types du helpdesk sont repris tels quels (habitudes de l'équipe),
-- complétés des catégories du CDC qui n'y figuraient pas.
INSERT INTO "support_category" ("code", "label", "position") VALUES
	('sav', 'SAV', 10),
	('commercial', 'Demande commerciale', 20),
	('order_tracking', 'Suivi de commande', 30),
	('warranty', 'Demande de garantie', 40),
	('return', 'Retour marchandise', 50),
	('saved_cart', 'Panier sauvegardé', 60),
	('delivery', 'Livraison', 70),
	('invoice', 'Facturation', 80),
	('other', 'Autre', 90)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "support_thread" (
	"id" serial PRIMARY KEY NOT NULL,
	-- Référence communiquée au client (accusé de réception).
	"reference" text NOT NULL,
	"customer_id" integer REFERENCES "customer"("id") ON DELETE SET NULL,
	-- Demandeur non authentifié (R1).
	"guest_email" text,
	"guest_name" text,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"category_id" integer REFERENCES "support_category"("id") ON DELETE RESTRICT,
	"priority" text DEFAULT 'normal' NOT NULL,
	"order_id" integer REFERENCES "order"("id") ON DELETE SET NULL,
	"assigned_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"unread_by_staff" integer DEFAULT 0 NOT NULL,
	"unread_by_customer" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- Conversation dont celle-ci est la suite (une conversation de
	-- l'historique ne se rouvre pas : y répondre en ouvre une nouvelle).
	-- Sans clé étrangère : l'identifiant peut désigner l'une ou l'autre table.
	"continues_thread_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "support_thread_status_chk"
		CHECK ("status" IN ('open', 'pending_staff', 'pending_customer', 'closed')),
	CONSTRAINT "support_thread_priority_chk"
		CHECK ("priority" IN ('low', 'normal', 'high', 'urgent')),
	-- Un client ou, à défaut, une adresse de réponse.
	CONSTRAINT "support_thread_requester_chk"
		CHECK ("customer_id" IS NOT NULL OR "guest_email" IS NOT NULL)
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_thread_reference_idx" ON "support_thread" ("reference");--> statement-breakpoint
-- Tri par défaut de la liste du back-office (R7).
CREATE INDEX IF NOT EXISTS "support_thread_status_last_idx" ON "support_thread" ("status", "last_message_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_thread_customer_idx" ON "support_thread" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_thread_order_idx" ON "support_thread" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_thread_assigned_idx" ON "support_thread" ("assigned_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_thread_category_idx" ON "support_thread" ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_thread_guest_email_idx" ON "support_thread" (lower("guest_email"));--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "support_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL REFERENCES "support_thread"("id") ON DELETE CASCADE,
	"sender_type" text NOT NULL,
	-- Auteur côté équipe ; nul pour un message du client.
	"sender_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"content" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_message_sender_chk"
		CHECK ("sender_type" IN ('customer', 'staff', 'internal_note'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_message_thread_idx" ON "support_message" ("thread_id", "created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "support_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL REFERENCES "support_message"("id") ON DELETE CASCADE,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	-- Clé de l'objet sur le stockage (Cloudflare R2, à venir).
	"storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_attachment_message_idx" ON "support_attachment" ("message_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Historique repris de PrestaShop — lecture seule
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "legacy_support_thread" (
	-- Même séquence que `support_thread` : les numéros ne se recouvrent pas.
	"id" integer PRIMARY KEY DEFAULT nextval('support_thread_id_seq') NOT NULL,
	-- `wkhelpdesk`, `ps_thread` (SAV natif) ou `ps_message` (commande).
	"source" text NOT NULL,
	"legacy_ps_id" integer NOT NULL,
	"reference" text NOT NULL,
	"customer_id" integer REFERENCES "customer"("id") ON DELETE SET NULL,
	"guest_email" text,
	"guest_name" text,
	"subject" text NOT NULL,
	"category_id" integer REFERENCES "support_category"("id") ON DELETE SET NULL,
	-- Statut tel qu'il était dans PrestaShop (`answered`, `resolved`…).
	"legacy_status" text,
	"order_id" integer REFERENCES "order"("id") ON DELETE SET NULL,
	-- Dernier membre de l'équipe à avoir écrit, nom figé à la reprise.
	"last_agent_name" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_support_thread_source_chk"
		CHECK ("source" IN ('wkhelpdesk', 'ps_thread', 'ps_message'))
);--> statement-breakpoint
-- Clé de reprise : relancer l'import ne crée pas de doublon.
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_support_thread_source_idx" ON "legacy_support_thread" ("source", "legacy_ps_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_support_thread_reference_idx" ON "legacy_support_thread" ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_support_thread_customer_idx" ON "legacy_support_thread" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_support_thread_order_idx" ON "legacy_support_thread" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_support_thread_last_idx" ON "legacy_support_thread" ("last_message_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_support_thread_category_idx" ON "legacy_support_thread" ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_support_thread_guest_email_idx" ON "legacy_support_thread" (lower("guest_email"));--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "legacy_support_message" (
	"id" integer PRIMARY KEY DEFAULT nextval('support_message_id_seq') NOT NULL,
	"thread_id" integer NOT NULL REFERENCES "legacy_support_thread"("id") ON DELETE CASCADE,
	-- `status_change` : changement de statut, pour savoir qui a traité.
	"kind" text NOT NULL,
	-- Nom de l'auteur tel qu'il figurait dans PrestaShop.
	"author_name" text,
	"content" text DEFAULT '' NOT NULL,
	"status_from" text,
	"status_to" text,
	"legacy_ps_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "legacy_support_message_kind_chk"
		CHECK ("kind" IN ('customer', 'staff', 'internal_note', 'status_change'))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_support_message_source_idx" ON "legacy_support_message" ("thread_id", "legacy_ps_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_support_message_thread_idx" ON "legacy_support_message" ("thread_id", "created_at");--> statement-breakpoint

-- Les fichiers restent sur l'ancien serveur pour l'instant : seule leur
-- trace est reprise, `storage_key` sera renseignée lors du transfert.
CREATE TABLE IF NOT EXISTS "legacy_support_attachment" (
	"id" integer PRIMARY KEY DEFAULT nextval('support_attachment_id_seq') NOT NULL,
	"message_id" integer NOT NULL REFERENCES "legacy_support_message"("id") ON DELETE CASCADE,
	"file_name" text NOT NULL,
	-- Chemin relatif à la racine PrestaShop (`modules/wkhelpdesk/…`, `upload/…`).
	"legacy_path" text NOT NULL,
	"storage_key" text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_support_attachment_message_idx" ON "legacy_support_attachment" ("message_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Lecture unifiée
-- ---------------------------------------------------------------------------

-- `is_legacy` reste interne : il sert à refuser l'écriture dans une
-- conversation de l'historique, jamais à l'afficher.
CREATE OR REPLACE VIEW "support_thread_all" AS
	SELECT
		t."id", t."reference", t."customer_id", t."guest_email", t."guest_name",
		t."subject", t."status", t."category_id", t."priority", t."order_id",
		t."assigned_user_id", t."unread_by_staff", t."unread_by_customer",
		t."last_message_at", t."continues_thread_id", t."created_at", t."closed_at",
		NULL::text AS "last_agent_name",
		false AS "is_legacy"
	FROM "support_thread" t
	UNION ALL
	SELECT
		l."id", l."reference", l."customer_id", l."guest_email", l."guest_name",
		l."subject", 'closed', l."category_id", 'normal', l."order_id",
		NULL, 0, 0,
		l."last_message_at", NULL, l."opened_at", l."last_message_at",
		l."last_agent_name",
		true
	FROM "legacy_support_thread" l;--> statement-breakpoint

CREATE OR REPLACE VIEW "support_message_all" AS
	SELECT
		m."id", m."thread_id", m."sender_type" AS "kind", m."sender_user_id",
		NULL::text AS "author_name", m."content",
		NULL::text AS "status_from", NULL::text AS "status_to",
		m."read_at", m."created_at",
		false AS "is_legacy"
	FROM "support_message" m
	UNION ALL
	SELECT
		l."id", l."thread_id", l."kind", NULL,
		l."author_name", l."content",
		l."status_from", l."status_to",
		l."created_at", l."created_at",
		true
	FROM "legacy_support_message" l;

-- Pop-ups d'annonce de la boutique.

CREATE TABLE IF NOT EXISTS "popup" (
	"id" serial PRIMARY KEY NOT NULL,
	-- Repère interne, jamais affiché au visiteur.
	"name" text NOT NULL,
	"title" text,
	"content" text DEFAULT '' NOT NULL,
	"image_url" text,
	"cta_label" text,
	"cta_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	-- Bornes facultatives : sans date de fin, la diffusion court jusqu'à
	-- désactivation.
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	-- `all`, `home` ou `paths`.
	"scope" text DEFAULT 'all' NOT NULL,
	"paths" text,
	"delay_seconds" integer DEFAULT 0 NOT NULL,
	-- Silence après fermeture, mémorisé par le navigateur du visiteur.
	"dismiss_days" integer DEFAULT 7 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "popup_active_idx" ON "popup" ("is_active", "priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "popup_window_idx" ON "popup" ("starts_at", "ends_at");

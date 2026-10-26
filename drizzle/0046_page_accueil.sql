-- Page d'accueil réglable en back-office (demandes 10.1, 10.3, 10.4) : tuiles
-- promotionnelles, catégories et produits mis en avant, réglages simples.
-- Tables nouvelles : aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS "home_promo_tile" (
	"id" serial PRIMARY KEY NOT NULL,
	"eyebrow" text,
	"title" text NOT NULL,
	"image_url" text,
	"link_url" text NOT NULL,
	"button_label" text DEFAULT 'Je découvre' NOT NULL,
	"tone" text DEFAULT 'blue' NOT NULL,
	"badge" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "home_featured_category" (
	"category_id" integer PRIMARY KEY NOT NULL REFERENCES "category"("id") ON DELETE cascade,
	"image_url" text,
	"position" integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS "home_featured_product" (
	"product_id" integer PRIMARY KEY NOT NULL REFERENCES "product"("id") ON DELETE cascade,
	"position" integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS "home_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);

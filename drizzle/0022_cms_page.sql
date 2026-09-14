CREATE TABLE "cms_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cms_page_slug_idx" ON "cms_page" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cms_page_published_idx" ON "cms_page" USING btree ("is_published");
CREATE TABLE "blog_article" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content_type" text DEFAULT 'article' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"video_url" text,
	"external_url" text,
	"cover_image_url" text,
	"excerpt" text,
	"meta_title" text,
	"meta_description" text,
	"blog_category_id" integer,
	"author_user_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"preview_token" text,
	"preview_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_article" ADD CONSTRAINT "blog_article_blog_category_id_blog_category_id_fk" FOREIGN KEY ("blog_category_id") REFERENCES "public"."blog_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_article" ADD CONSTRAINT "blog_article_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_article_slug_idx" ON "blog_article" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_article_status_published_idx" ON "blog_article" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "blog_article_category_idx" ON "blog_article" USING btree ("blog_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_category_slug_idx" ON "blog_category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_category_order_idx" ON "blog_category" USING btree ("sort_order");
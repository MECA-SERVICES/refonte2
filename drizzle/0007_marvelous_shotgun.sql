CREATE TABLE "machine_brand" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_ps_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_model" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"machine_type" text,
	"year_from" integer,
	"year_to" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_ps_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_compatibility" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"year_from" integer,
	"year_to" integer,
	"source" text DEFAULT 'legacy' NOT NULL,
	"rule" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "source" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "type" text DEFAULT 'part' NOT NULL;--> statement-breakpoint
ALTER TABLE "machine_model" ADD CONSTRAINT "machine_model_brand_id_machine_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."machine_brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_compatibility" ADD CONSTRAINT "product_compatibility_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_compatibility" ADD CONSTRAINT "product_compatibility_model_id_machine_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "machine_brand_slug_idx" ON "machine_brand" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "machine_model_brand_idx" ON "machine_model" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_model_brand_slug_idx" ON "machine_model" USING btree ("brand_id","slug");--> statement-breakpoint
CREATE INDEX "product_compatibility_product_idx" ON "product_compatibility" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_compatibility_model_idx" ON "product_compatibility" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_compatibility_unique_idx" ON "product_compatibility" USING btree ("product_id","model_id");--> statement-breakpoint
CREATE INDEX "product_type_idx" ON "product" USING btree ("type");
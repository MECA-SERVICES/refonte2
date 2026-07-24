CREATE TABLE "stock_movement" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"quantity" integer NOT NULL,
	"type" text NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(6, 3) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"legacy_ps_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tax_rule_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movement_product_idx" ON "stock_movement" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movement_variant_idx" ON "stock_movement" USING btree ("variant_id");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tax_rule_id_tax_rule_id_fk" FOREIGN KEY ("tax_rule_id") REFERENCES "public"."tax_rule"("id") ON DELETE set null ON UPDATE no action;
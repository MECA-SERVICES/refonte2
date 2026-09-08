CREATE TABLE "product_spec" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"value_num" numeric(14, 4),
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_spec" ADD CONSTRAINT "product_spec_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_spec_product_idx" ON "product_spec" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_spec_name_value_idx" ON "product_spec" USING btree ("name","value");--> statement-breakpoint
CREATE INDEX "product_spec_name_num_idx" ON "product_spec" USING btree ("name","value_num");--> statement-breakpoint
CREATE UNIQUE INDEX "product_spec_unique_idx" ON "product_spec" USING btree ("product_id","name");
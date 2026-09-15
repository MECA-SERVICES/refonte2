CREATE TABLE "client_machine" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"name" text NOT NULL,
	"equipment_type" text NOT NULL,
	"brand" text,
	"model" text,
	"serial_number" text,
	"engine_model" text,
	"engine_serial_number" text,
	"warranty_info" text,
	"warranty_end_date" timestamp with time zone,
	"image_url" text,
	"notes" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"product_id" integer,
	"order_id" integer,
	"order_line_id" integer,
	"repair_order_id" integer,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_machine" ADD CONSTRAINT "client_machine_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_machine" ADD CONSTRAINT "client_machine_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_machine" ADD CONSTRAINT "client_machine_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_machine" ADD CONSTRAINT "client_machine_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_machine_customer_idx" ON "client_machine" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "client_machine_status_idx" ON "client_machine" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "client_machine_serial_idx" ON "client_machine" USING btree ("customer_id","serial_number") WHERE serial_number IS NOT NULL;--> statement-breakpoint
CREATE INDEX "client_machine_order_line_idx" ON "client_machine" USING btree ("order_line_id");
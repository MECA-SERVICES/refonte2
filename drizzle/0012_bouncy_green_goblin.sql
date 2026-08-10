CREATE TABLE "order_invoice" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"number" text NOT NULL,
	"delivery_number" text,
	"delivery_date" timestamp with time zone,
	"total_ht" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_ttc" numeric(12, 4) DEFAULT '0' NOT NULL,
	"shipping_ht" numeric(12, 4) DEFAULT '0' NOT NULL,
	"shipping_ttc" numeric(12, 4) DEFAULT '0' NOT NULL,
	"discount_ht" numeric(12, 4) DEFAULT '0' NOT NULL,
	"discount_ttc" numeric(12, 4) DEFAULT '0' NOT NULL,
	"shop_address" text,
	"note" text,
	"legacy_ps_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"method" text,
	"transaction_id" text,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"legacy_ps_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_invoice" ADD CONSTRAINT "order_invoice_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_invoice_order_idx" ON "order_invoice" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_invoice_number_idx" ON "order_invoice" USING btree ("number");--> statement-breakpoint
CREATE INDEX "order_payment_order_idx" ON "order_payment" USING btree ("order_id");
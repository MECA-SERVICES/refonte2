ALTER TABLE "customer" ADD COLUMN "vat_number_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "billing_country" varchar(2) DEFAULT 'FR' NOT NULL;
ALTER TABLE "product" ADD COLUMN "ecotax" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "available_for_order" boolean DEFAULT true NOT NULL;
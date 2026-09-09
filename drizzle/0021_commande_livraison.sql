ALTER TABLE "order" ADD COLUMN "carrier_code" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "carrier_name" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_option_code" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "package_length_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "package_width_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "package_height_cm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "sendcloud_shipment_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "sendcloud_parcel_id" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "label_url" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "last_tracking_update" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "relay_point_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "relay_point_name" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "relay_point_address" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "additional_shipping_fee" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "additional_fee_reason" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "used_fallback_shipping" boolean DEFAULT false NOT NULL;
ALTER TABLE "cart" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN "session_token" text;--> statement-breakpoint
ALTER TABLE "cart_item" ADD COLUMN "price_ht_at_add" numeric(12, 4);--> statement-breakpoint
CREATE UNIQUE INDEX "cart_session_token_idx" ON "cart" USING btree ("session_token");
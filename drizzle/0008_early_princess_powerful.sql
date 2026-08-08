ALTER TABLE "product" ADD COLUMN "legacy_category_ps_id" integer;--> statement-breakpoint
CREATE INDEX "product_legacy_category_idx" ON "product" USING btree ("legacy_category_ps_id");
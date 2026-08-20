DROP INDEX "product_media_legacy_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_legacy_unique_idx" ON "product_media" USING btree ("legacy_ps_id") WHERE legacy_ps_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "cart_item_product_idx" ON "cart_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_item_variant_idx" ON "cart_item" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_line_product_idx" ON "order_line" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_line_variant_idx" ON "order_line" USING btree ("variant_id");
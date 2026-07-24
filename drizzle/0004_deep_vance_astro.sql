DROP INDEX "product_slug_idx";--> statement-breakpoint
DROP INDEX "product_reference_idx";--> statement-breakpoint
CREATE INDEX "product_slug_idx" ON "product" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_reference_idx" ON "product" USING btree ("reference");
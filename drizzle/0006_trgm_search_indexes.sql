CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "address_customer_idx" ON "address" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "address_created_at_idx" ON "address" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "address_first_name_trgm_idx" ON "address" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "address_last_name_trgm_idx" ON "address" USING gin ("last_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "address_city_trgm_idx" ON "address" USING gin ("city" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "address_postal_code_trgm_idx" ON "address" USING gin ("postal_code" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customer_created_at_idx" ON "customer" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customer_first_name_trgm_idx" ON "customer" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customer_last_name_trgm_idx" ON "customer" USING gin ("last_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customer_email_trgm_idx" ON "customer" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customer_phone_trgm_idx" ON "customer" USING gin ("phone" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customer_company_trgm_idx" ON "customer" USING gin ("company_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customer_siret_trgm_idx" ON "customer" USING gin ("siret" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customer_vat_trgm_idx" ON "customer" USING gin ("vat_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_name_trgm_idx" ON "product" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_reference_trgm_idx" ON "product" USING gin ("reference" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_supplier_ref_trgm_idx" ON "product" USING gin ("supplier_reference" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_ean13_trgm_idx" ON "product" USING gin ("ean13" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "cart_last_activity_idx" ON "cart" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "order_created_at_idx" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_reference_trgm_idx" ON "order" USING gin ("reference" gin_trgm_ops);
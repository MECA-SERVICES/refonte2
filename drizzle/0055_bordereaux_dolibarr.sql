-- Bordereaux de remise de chèques repris de Dolibarr (`llx_bordereau_cheque.rowid`).
ALTER TABLE "remittance" ADD COLUMN IF NOT EXISTS "legacy_doli_id" integer;
CREATE UNIQUE INDEX IF NOT EXISTS "remittance_legacy_doli_id_idx" ON "remittance" ("legacy_doli_id") WHERE "legacy_doli_id" IS NOT NULL;

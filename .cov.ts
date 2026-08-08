import { sourceQuery, closeSourceDb } from './scripts/migrations/prestashop/source-db.ts';
// Colonnes ps_product réellement reprises par 03-products.ts
const TAKEN = new Set(['id_product','id_manufacturer','id_category_default','id_supplier','reference','supplier_reference','ean13','price','wholesale_price','weight','width','height','depth','additional_shipping_cost','active','quantity','date_add','date_upd']);
const cols = await sourceQuery<{COLUMN_NAME:string}>(
 `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ps_product' ORDER BY ORDINAL_POSITION`);
const ignored = cols.map(c=>c.COLUMN_NAME).filter(c=>!TAKEN.has(c));
console.log(`ps_product : ${cols.length} colonnes — ${TAKEN.size} reprises, ${ignored.length} non reprises`);
console.log('\nNON REPRISES :', ignored.join(', '));
// Lesquelles portent réellement de la donnée ?
console.log('\n=== Colonnes non reprises contenant des valeurs non triviales ===');
for (const c of ignored) {
  try {
    const [r] = await sourceQuery<{n:number}>(
      `SELECT COUNT(*) AS n FROM ps_product WHERE \`${c}\` IS NOT NULL AND \`${c}\` NOT IN ('','0','0.000000','0000-00-00 00:00:00')`);
    if (Number(r.n) > 1000) console.log(`  ${String(r.n).padStart(9)}  ${c}`);
  } catch {}
}
await closeSourceDb();

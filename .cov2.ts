import { sourceQuery, closeSourceDb } from './scripts/migrations/prestashop/source-db.ts';
const check = [
 ['id_tax_rules_group','TVA — groupe de règles de taxe'],
 ['ecotax','Éco-participation (DEEE)'],
 ['on_sale','Drapeau « en promo »'],
 ['minimal_quantity','Quantité minimale de commande'],
 ['available_for_order','Commandable'],
 ['show_price','Prix affiché'],
 ['visibility','Visibilité (both/catalog/search/none)'],
 ['condition','État (new/used/refurbished)'],
 ['stock_fournisseur','Stock fournisseur'],
 ['unity','Unité de vente'],
 ['location','Emplacement entrepôt'],
];
console.log('=== Distribution des colonnes non reprises ===\n');
for (const [c,label] of check) {
  const rows = await sourceQuery<{v:string;n:number}>(
    `SELECT \`${c}\` AS v, COUNT(*) AS n FROM ps_product GROUP BY \`${c}\` ORDER BY n DESC LIMIT 4`);
  const total = rows.reduce((s,r)=>s+Number(r.n),0);
  const top = rows.map(r=>`${r.v===null?'NULL':r.v}=${r.n}`).join('  ');
  const uniforme = rows.length===1;
  console.log(`${uniforme?'  ':'⚠️'} ${c.padEnd(22)} ${label}`);
  console.log(`     ${top}${uniforme?'   → valeur unique, sans intérêt':''}`);
}
// La TVA : combien de groupes distincts, et sont-ils utilisés ?
const tva = await sourceQuery<{id_tax_rules_group:number;n:number}>(
  `SELECT id_tax_rules_group, COUNT(*) AS n FROM ps_product GROUP BY id_tax_rules_group ORDER BY n DESC`);
console.log(`\n=== TVA : ${tva.length} groupe(s) distinct(s) ===`);
for(const t of tva.slice(0,6)) console.log(`   groupe ${t.id_tax_rules_group} : ${t.n} produits`);
await closeSourceDb();

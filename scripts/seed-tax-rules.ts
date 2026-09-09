/**
 * Création des règles de TVA françaises et affectation aux produits.
 *
 * La table `tax_rule` est vide depuis la reprise : faute de règle, tout produit
 * s'affiche au même montant en HT et en TTC. Les taux d'origine PrestaShop
 * n'ayant pas été repris, les produits sont rattachés au **taux normal**, qui
 * couvre la quasi-totalité d'un catalogue de motoculture. Les exceptions se
 * corrigent ensuite depuis `/admin/taxes` et la fiche produit.
 *
 * Usage :
 *   bun run tax:seed              # crée les règles et affecte le taux normal
 *   bun run tax:seed -- --dry-run # simulation, aucune écriture
 */

import postgres from 'postgres';
import { loadEnv } from './lib/env.ts';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const dryRun = process.argv.includes('--dry-run');
const sql = postgres(url, { ssl: 'require' });

/** Taux en vigueur en France métropolitaine. */
const RULES = [
	{ name: 'Taux normal 20 %', rate: '20.000', isDefault: true },
	{ name: 'Taux intermédiaire 10 %', rate: '10.000', isDefault: false },
	{ name: 'Taux réduit 5,5 %', rate: '5.500', isDefault: false },
	{ name: 'Taux particulier 2,1 %', rate: '2.100', isDefault: false }
];

console.log(`\n=== Règles de TVA ${dryRun ? '(simulation)' : ''} ===\n`);

for (const rule of RULES) {
	const [existing] = await sql`SELECT id FROM tax_rule WHERE name = ${rule.name}`;
	if (existing) {
		console.log(`  = ${rule.name} — déjà présente`);
		continue;
	}
	if (!dryRun) {
		await sql`INSERT INTO tax_rule ${sql({
			name: rule.name,
			rate: rule.rate,
			is_active: true,
			is_default: rule.isDefault
		})}`;
	}
	console.log(`  + ${rule.name}`);
}

const [normal] = await sql<{ id: number }[]>`
	SELECT id FROM tax_rule WHERE is_default = true ORDER BY id LIMIT 1
`;

const [{ total }] = await sql<{ total: number }[]>`
	SELECT count(*)::int AS total FROM product WHERE tax_rule_id IS NULL
`;
console.log(`\n${total.toLocaleString('fr-FR')} produits sans règle de TVA`);

if (!dryRun && normal) {
	// Un seul UPDATE : la colonne est indexée par la clé étrangère, et le
	// catalogue entier tient largement dans une transaction.
	const result = await sql`UPDATE product SET tax_rule_id = ${normal.id} WHERE tax_rule_id IS NULL`;
	console.log(`${result.count.toLocaleString('fr-FR')} produits rattachés au taux normal`);
}

const check = await sql<{ name: string; rate: string; n: number }[]>`
	SELECT r.name, r.rate, count(p.id)::int AS n
	FROM tax_rule r LEFT JOIN product p ON p.tax_rule_id = r.id
	GROUP BY r.id, r.name, r.rate ORDER BY r.rate DESC
`;
console.log('\n--- Répartition ---');
for (const r of check) {
	console.log(`  ${r.name.padEnd(26)} ${Number(r.rate).toFixed(2)} %  ${r.n.toLocaleString('fr-FR')} produits`);
}
console.log();

await sql.end();

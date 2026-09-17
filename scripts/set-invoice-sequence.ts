/**
 * Cale la séquence de numérotation des factures.
 *
 * ⚠️ À exécuter avant la première facture émise en production.
 *
 * PrestaShop a continué d'émettre après l'export : le plus grand numéro migré
 * (25470) est inférieur au dernier réellement facturé — la facture FA025633 en
 * circulation le prouve. Démarrer sur le max en base réémettrait donc des
 * numéros déjà utilisés, ce qu'interdit la numérotation légale (CDC 24, R2).
 *
 * Usage :
 *   bun run invoices:seq              # affiche l'état, ne modifie rien
 *   bun run invoices:seq -- 25700     # cale sur 25700
 */

import postgres from 'postgres';
import { loadEnv } from './lib/env.ts';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const sql = postgres(url, { ssl: 'require' });

const target = process.argv.slice(2).find((a) => /^\d+$/.test(a));

const [state] = await sql<{ last_value: string }[]>`
	SELECT last_value::text FROM order_invoice_number_seq
`;
const [{ max_migrated }] = await sql<{ max_migrated: string | null }[]>`
	SELECT max(number::bigint)::text AS max_migrated
	FROM order_invoice WHERE number ~ '^[0-9]+$'
`;

console.log(`\n=== Numérotation des factures ===\n`);
console.log(`Séquence actuelle : ${state?.last_value}`);
console.log(`Plus grand numéro en base : ${max_migrated ?? '—'}`);

if (!target) {
	console.log(`\nAucune valeur fournie — rien modifié.`);
	console.log(`Fournissez le dernier numéro réellement émis par PrestaShop.`);
} else {
	const value = Number(target);
	const max = Number(max_migrated ?? 0);

	if (value < max) {
		console.error(`\n✗ Refusé : ${value} est inférieur au plus grand numéro en base (${max}).`);
		await sql.end();
		process.exit(1);
	}

	await sql`SELECT setval('order_invoice_number_seq', ${value})`;
	console.log(`\n✓ Séquence calée sur ${value}.`);
	console.log(`  La prochaine facture portera le n° ${value + 1}.`);
}

await sql.end();

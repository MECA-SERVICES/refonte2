/**
 * Reprise des adresses par défaut du carnet client.
 *
 * Les indicateurs `is_default_shipping` / `is_default_billing` n'ont pas été
 * repris de PrestaShop : les 37 019 adresses migrées les portent tous à `false`.
 * Sans eux, le carnet n'affiche aucune adresse principale et le tunnel de
 * commande n'aura rien à présélectionner.
 *
 * L'adresse retenue est la **plus récente** de chaque client : c'est celle qu'il
 * a saisie en dernier, donc la plus susceptible d'être encore valide. Les
 * clients possédant déjà un indicateur ne sont jamais touchés.
 *
 * Usage :
 *   bun run addresses:backfill              # applique
 *   bun run addresses:backfill -- --dry-run # simulation
 */

import postgres from 'postgres';
import { loadEnv } from './lib/env.ts';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const dryRun = process.argv.includes('--dry-run');
const sql = postgres(url, { ssl: 'require' });

console.log(`\n=== Adresses par défaut ${dryRun ? '(simulation)' : ''} ===\n`);

const [{ concerned }] = await sql<{ concerned: number }[]>`
	SELECT count(*)::int AS concerned FROM (
		SELECT customer_id FROM address
		GROUP BY customer_id
		HAVING count(*) FILTER (WHERE is_default_shipping OR is_default_billing) = 0
	) z
`;
console.log(`${concerned.toLocaleString('fr-FR')} clients sans adresse par défaut`);

if (!dryRun && concerned > 0) {
	// `DISTINCT ON` retient une seule ligne par client, la première selon le
	// tri — ici la plus récente, l'identifiant départageant les ex æquo.
	const result = await sql`
		UPDATE address SET is_default_shipping = true, is_default_billing = true
		WHERE id IN (
			SELECT DISTINCT ON (customer_id) id FROM address
			WHERE customer_id IN (
				SELECT customer_id FROM address
				GROUP BY customer_id
				HAVING count(*) FILTER (WHERE is_default_shipping OR is_default_billing) = 0
			)
			ORDER BY customer_id, created_at DESC, id DESC
		)
	`;
	console.log(`${result.count.toLocaleString('fr-FR')} adresses promues par défaut`);
}

const [check] = await sql<{ shipping: number; billing: number; dup: number }[]>`
	SELECT
		(SELECT count(*)::int FROM address WHERE is_default_shipping) AS shipping,
		(SELECT count(*)::int FROM address WHERE is_default_billing) AS billing,
		(SELECT count(*)::int FROM (
			SELECT customer_id FROM address WHERE is_default_shipping
			GROUP BY customer_id HAVING count(*) > 1) z) AS dup
`;
console.log(`\n--- Contrôle ---`);
console.log(`  adresses de livraison par défaut   : ${check.shipping.toLocaleString('fr-FR')}`);
console.log(`  adresses de facturation par défaut : ${check.billing.toLocaleString('fr-FR')}`);
console.log(`  clients en doublon (doit être 0)   : ${check.dup}`);
console.log();

await sql.end();

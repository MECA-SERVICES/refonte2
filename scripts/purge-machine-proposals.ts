/**
 * Retire du parc les propositions restées sans réponse — CDC 32, R14.
 *
 * Une machine proposée automatiquement et jamais confirmée disparaît au bout de
 * six mois : passé ce délai, le client ne la possède probablement pas, ou ne
 * souhaite pas la déclarer.
 *
 * Destiné à une exécution périodique (tâche planifiée).
 *
 * Usage :
 *   bun run machines:purge
 *   bun run machines:purge -- --dry-run
 */

import postgres from 'postgres';
import { loadEnv } from './lib/env.ts';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const dryRun = process.argv.includes('--dry-run');
const sql = postgres(url, { ssl: 'require' });

const [{ total }] = await sql<{ total: number }[]>`
	SELECT count(*)::int AS total FROM client_machine
	WHERE status = 'pending_confirmation'
	AND created_at < now() - interval '6 months'
`;

console.log(`\n${total} proposition(s) expirée(s)${dryRun ? ' (simulation)' : ''}`);

if (!dryRun && total > 0) {
	const result = await sql`
		DELETE FROM client_machine
		WHERE status = 'pending_confirmation'
		AND created_at < now() - interval '6 months'
	`;
	console.log(`${result.count} retirée(s) du parc.`);
}

console.log();
await sql.end();

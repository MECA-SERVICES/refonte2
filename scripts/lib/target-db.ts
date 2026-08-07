/**
 * Connexion à la base **cible** du projet (`DATABASE_URL` — sakura).
 *
 * C'est la seule base que les scripts sont autorisés à écrire.
 * Voir `MIGRATION-CATALOGUE.md` §2.2.
 *
 * On expose le client `postgres` brut plutôt que Drizzle : les scripts font des
 * insertions par lots de plusieurs centaines de milliers de lignes, où le
 * `sql``INSERT INTO x ${sql(rows)}` `` est nettement plus direct et plus rapide.
 */
import postgres from 'postgres';
import { requireEnv, maskUrl } from './env.ts';

let client: postgres.Sql | null = null;

/** Client Postgres vers la base cible (singleton par process). */
export function targetDb(): postgres.Sql {
	if (client) return client;

	const url = requireEnv('DATABASE_URL');
	client = postgres(url, {
		max: 8,
		// Les gros lots (COPY-like) peuvent dépasser le défaut de 30 s.
		idle_timeout: 60,
		connect_timeout: 30,
		// Les scripts affichent leur propre progression : pas de bruit supplémentaire.
		onnotice: () => {}
	});

	return client;
}

/** URL cible masquée, pour affichage. */
export function targetLabel(): string {
	return maskUrl(requireEnv('DATABASE_URL'));
}

export async function closeTargetDb(): Promise<void> {
	if (!client) return;
	await client.end();
	client = null;
}

/**
 * Insère des lignes par lots, en signalant la progression.
 *
 * `postgres` construit une requête multi-valeurs à partir du tableau d'objets ;
 * au-delà de quelques milliers de lignes, on dépasse la limite de paramètres
 * côté serveur, d'où le découpage.
 */
export async function insertBatched(
	table: string,
	rows: Record<string, unknown>[],
	options: { batchSize?: number; onProgress?: (done: number) => void } = {}
): Promise<number> {
	if (rows.length === 0) return 0;

	const sql = targetDb();
	const batchSize = options.batchSize ?? 1000;
	let inserted = 0;

	for (let i = 0; i < rows.length; i += batchSize) {
		const batch = rows.slice(i, i + batchSize);
		await sql`INSERT INTO ${sql(table)} ${sql(batch)}`;
		inserted += batch.length;
		options.onProgress?.(inserted);
	}

	return inserted;
}

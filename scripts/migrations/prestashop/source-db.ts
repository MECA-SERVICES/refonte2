/**
 * Connexion **LECTURE SEULE** à la base PrestaShop d'origine (`prod5`, MariaDB 10.3).
 *
 * Le serveur MySQL n'est pas exposé : l'accès passe obligatoirement par un
 * tunnel SSH, ouvert et refermé par ce module (voir `MIGRATION-CATALOGUE.md` §2.1).
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  RÈGLE NON NÉGOCIABLE : aucune écriture sur cette base.
 *  Le garde-fou est appliqué **par le code** (`assertReadOnly`), pas seulement
 *  par convention — toute requête non-lecture lève avant d'atteindre le réseau.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Deux pièges d'environnement, constatés et documentés :
 *  - le serveur utilise `mysql_native_password`, retiré du client MySQL 9.x :
 *    le binaire `mysql` échoue en ERROR 2059 → on passe par le driver `mysql2` ;
 *  - le cache bun a une résolution cassée sur `iconv-lite` → `safer-buffer` :
 *    ces scripts s'exécutent avec `node`, pas `bun` (voir package.json).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection, type Connection } from 'mysql2/promise';
import { requireEnv } from '../../lib/env.ts';
import { log } from '../../lib/logger.ts';

/** Port local du tunnel (évite 3306 pour ne pas heurter un MySQL local). */
const LOCAL_PORT = 13306;

/** Mots-clés interdits : toute écriture ou modification de session/serveur. */
const FORBIDDEN =
	/\b(insert|update|delete|drop|truncate|alter|create|replace|grant|revoke|rename|set|lock|unlock|call|load|handler|commit|rollback|savepoint|flush|kill|shutdown|analyze|optimize|repair)\b/i;

/**
 * `SELECT ... INTO OUTFILE|DUMPFILE` écrit un fichier **sur le serveur source**.
 * La requête commence par `SELECT` et ne contient aucun mot-clé de la liste
 * ci-dessus : sans ce contrôle dédié, elle passerait les deux filtres.
 */
const SELECT_INTO_FILE = /\binto\s+(outfile|dumpfile)\b/i;

/** Verbes autorisés en tête de requête. */
const ALLOWED_START = /^\s*(select|show|describe|desc|explain|with)\b/i;

/**
 * Valide qu'une requête est bien en lecture seule.
 * Exportée pour être testable indépendamment de toute connexion.
 */
export function assertReadOnly(sql: string): void {
	const stripped = sql
		.replace(/'(?:[^'\\]|\\.)*'/g, "''") // littéraux simples
		.replace(/"(?:[^"\\]|\\.)*"/g, '""') // littéraux doubles
		.replace(/`[^`]*`/g, '``') // identifiants échappés
		.replace(/\/\*[\s\S]*?\*\//g, ' ') // commentaires bloc
		.replace(/(--|#)[^\n]*/g, ' '); // commentaires ligne

	if (!ALLOWED_START.test(stripped)) {
		throw new Error(`REFUSÉ — requête non-lecture sur la source PrestaShop : ${sql.slice(0, 120)}`);
	}

	if (SELECT_INTO_FILE.test(stripped)) {
		throw new Error(
			`REFUSÉ — écriture de fichier sur la source PrestaShop (INTO OUTFILE/DUMPFILE) : ` +
				sql.slice(0, 120)
		);
	}

	const match = FORBIDDEN.exec(stripped);
	if (match) {
		throw new Error(
			`REFUSÉ — mot-clé d'écriture « ${match[1]} » détecté sur la source PrestaShop : ` +
				sql.slice(0, 120)
		);
	}

	// `;` hors littéral ⇒ tentative de requête multiple.
	if (/;\s*\S/.test(stripped)) {
		throw new Error(`REFUSÉ — requêtes multiples interdites : ${sql.slice(0, 120)}`);
	}
}

let tunnel: ChildProcess | null = null;
let connection: Connection | null = null;

/** Ouvre le tunnel SSH et attend que le port local réponde. */
async function openTunnel(): Promise<void> {
	if (tunnel) return;

	const sshHost = requireEnv('DB_SERVER');
	const sshPort = requireEnv('DB_SERVER_PORT');
	const sshUser = requireEnv('SSH_SERVER_USER');
	const sshPassword = requireEnv('SSH_SERVER_PASSWORD');
	const dbHost = requireEnv('DB_HOST');
	const dbPort = requireEnv('DB_PORT');

	log.step(`Ouverture du tunnel SSH ${sshUser}@${sshHost} → ${dbHost}:${dbPort}`);

	// `sshpass` évite l'invite interactive. `-N` : pas de shell distant.
	tunnel = spawn(
		'sshpass',
		[
			'-p',
			sshPassword,
			'ssh',
			'-N',
			'-o',
			'StrictHostKeyChecking=no',
			'-o',
			'ExitOnForwardFailure=yes',
			'-o',
			'ServerAliveInterval=30',
			'-L',
			`${LOCAL_PORT}:${dbHost}:${dbPort}`,
			'-p',
			sshPort,
			`${sshUser}@${sshHost}`
		],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);

	let stderr = '';
	tunnel.stderr?.on('data', (c) => (stderr += String(c)));

	const exited = new Promise<never>((_, reject) => {
		tunnel?.once('exit', (code) => {
			tunnel = null;
			reject(new Error(`Tunnel SSH fermé (code ${code}) : ${stderr.trim() || 'aucun détail'}`));
		});
	});

	// Sonde le port jusqu'à ce qu'il accepte les connexions (max ~15 s).
	const ready = (async () => {
		const { connect } = await import('node:net');
		for (let i = 0; i < 60; i++) {
			const ok = await new Promise<boolean>((resolve) => {
				const socket = connect(LOCAL_PORT, '127.0.0.1');
				socket.once('connect', () => (socket.destroy(), resolve(true)));
				socket.once('error', () => resolve(false));
			});
			if (ok) return;
			await new Promise((r) => setTimeout(r, 250));
		}
		throw new Error(`Le tunnel SSH n'écoute pas sur 127.0.0.1:${LOCAL_PORT} après 15 s`);
	})();

	await Promise.race([ready, exited]);
	log.muted(`tunnel actif sur 127.0.0.1:${LOCAL_PORT}`);
}

/** Connexion MySQL à travers le tunnel (singleton par process). */
async function connect(): Promise<Connection> {
	if (connection) return connection;

	await openTunnel();

	connection = await createConnection({
		host: '127.0.0.1',
		port: LOCAL_PORT,
		user: requireEnv('DB_USER'),
		password: requireEnv('DB_PASSWORD'),
		database: requireEnv('DB_DATABASE_PRESTASHOP'),
		// Défense en profondeur : même si `assertReadOnly` laissait passer un `;`,
		// le driver refuserait d'exécuter plusieurs requêtes.
		multipleStatements: false,
		connectTimeout: 30_000,
		// Les gros SELECT (1 M de lignes) sont lus en flux, pas mis en cache.
		rowsAsArray: false
	});

	log.muted(`connecté à ${requireEnv('DB_DATABASE_PRESTASHOP')} (lecture seule)`);
	return connection;
}

/**
 * Exécute un SELECT sur la source. Refuse toute requête d'écriture.
 *
 * @example const rows = await sourceQuery<{ id: number }>('SELECT id FROM ps_product LIMIT 10');
 */
export async function sourceQuery<T = Record<string, unknown>>(
	sql: string,
	params: unknown[] = []
): Promise<T[]> {
	assertReadOnly(sql);
	const conn = await connect();
	const [rows] = await conn.query(sql, params);
	return rows as T[];
}

/** Variante pour les requêtes ne renvoyant qu'une ligne. */
export async function sourceQueryOne<T = Record<string, unknown>>(
	sql: string,
	params: unknown[] = []
): Promise<T | undefined> {
	const rows = await sourceQuery<T>(sql, params);
	return rows[0];
}

/**
 * Parcourt une table volumineuse par pages, sans charger 1 M de lignes en mémoire.
 *
 * La pagination est faite par **clé** (`WHERE id > ?`) et non par `OFFSET` :
 * sur 1 M de lignes, `OFFSET` devient quadratique.
 *
 * ── Clés non uniques ───────────────────────────────────────────────────────
 *
 *  `ps_category_product` porte plusieurs lignes par `id_product`. Couper la
 *  page au milieu d'un groupe et reprendre à `> lastKey` **perdrait** les
 *  liaisons restantes de ce produit.
 *
 *  On écarte donc la dernière valeur de clé de chaque page (elle sera relue au
 *  tour suivant, groupe complet), sauf si la page entière porte la même clé —
 *  auquel cas on avance quand même, pour ne pas boucler indéfiniment.
 *
 * @param select requête contenant `{{WHERE}}`, remplacé par la condition de curseur
 * @param keyColumn colonne de curseur, croissante (qualifiée si besoin : `p.id_product`)
 * @param pageSize nombre de lignes lues par aller-retour
 * @param uniqueKey `true` si la clé est unique (PK) : la page est alors rendue
 *   telle quelle, sans traitement de groupe
 * @param fetchPage exécuteur de requête — injectable pour tester la pagination
 *   sans base ni tunnel SSH ; par défaut, la source réelle en lecture seule
 */
export async function* sourceCursor<T extends Record<string, unknown>>(
	select: string,
	keyColumn: string,
	pageSize = 5000,
	uniqueKey = true,
	fetchPage: (sql: string) => Promise<T[]> = (sql) => sourceQuery<T>(sql)
): AsyncGenerator<T[]> {
	// MySQL renvoie les colonnes sous leur nom court : une clé qualifiée
	// (`p.id_product`) doit être déqualifiée pour relire la valeur dans la ligne.
	const field = keyColumn.split('.').pop() as string;

	let lastKey: number | string | null = null;

	for (;;) {
		const where =
			lastKey === null
				? ''
				: `AND ${keyColumn} > ${typeof lastKey === 'number' ? lastKey : `'${lastKey}'`}`;

		const sql = `${select.replace('{{WHERE}}', where)} ORDER BY ${keyColumn} LIMIT ${pageSize}`;
		const rows = await fetchPage(sql);
		if (rows.length === 0) return;

		const lastValue = rows[rows.length - 1][field] as number | string;
		if (lastValue === undefined) {
			throw new Error(
				`sourceCursor : la colonne de curseur « ${field} » est absente du résultat. ` +
					'Elle doit figurer dans la liste des colonnes sélectionnées.'
			);
		}

		// Dernière page : plus rien à couper, on rend tout.
		if (rows.length < pageSize) {
			yield rows;
			return;
		}

		if (uniqueKey) {
			yield rows;
			lastKey = lastValue;
			continue;
		}

		// Clé non unique : on retire le dernier groupe, potentiellement incomplet.
		const cut = rows.findIndex((r) => r[field] === lastValue);
		if (cut === 0) {
			// La page entière porte la même clé : impossible de couper sans
			// bloquer. On rend tout et on avance — un groupe plus large qu'une
			// page reste correctement traité, au prix d'une page pleine.
			yield rows;
			lastKey = lastValue;
			continue;
		}

		yield rows.slice(0, cut);
		// On reprend *à* cette clé, exclue de ce qui vient d'être rendu.
		lastKey = rows[cut - 1][field] as number | string;
	}
}

/** Ferme la connexion MySQL puis le tunnel SSH. Idempotent. */
export async function closeSourceDb(): Promise<void> {
	if (connection) {
		await connection.end().catch(() => {});
		connection = null;
	}
	if (tunnel) {
		const proc = tunnel;
		tunnel = null;
		proc.removeAllListeners('exit');
		proc.kill();
	}
}

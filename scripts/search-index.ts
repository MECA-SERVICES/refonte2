/**
 * Index de recherche Meilisearch — construction et rattrapage.
 *
 * Définition des index et des documents : `src/lib/server/search-index/`,
 * partagée avec l'application (qui synchronise au fil des enregistrements
 * admin). Ce script couvre ce que l'application ne voit pas : imports,
 * scripts de migration, écritures SQL directes.
 *
 * Usage :
 *   bun run search:reindex                 # reconstruction complète, sans coupure
 *   bun run search:reindex -- --setup      # idem + crée la clé applicative MEILI_API_KEY
 *   bun run search:sync                    # produits modifiés depuis 26 h (planifier chaque nuit)
 *   bun run search:sync -- --since=7d      # fenêtre plus large
 *   bun run search:settings                # réglages seuls (après modification des synonymes)
 *   bun run search:suggestions             # rayons, marques et suggestions seuls (~1 min)
 *
 * La reconstruction remplit un index à part (`products_rebuild`), puis le
 * bascule d'un bloc sur `products` : la boutique cherche dans l'ancien index
 * jusqu'à la dernière seconde, et rien ne change si le script échoue en route.
 *
 * Utilise la clé maître (`MEILI_MASTER_KEY`) : jamais l'application.
 */
import { Meilisearch, type EnqueuedTaskPromise, type Settings } from 'meilisearch';
import { requireEnv } from './lib/env.ts';
import { closeTargetDb, targetDb, targetLabel } from './lib/target-db.ts';
import { count, duration, log, progress } from './lib/logger.ts';
import {
	BRANDS_INDEX,
	BRANDS_SETTINGS,
	CATEGORIES_INDEX,
	CATEGORIES_SETTINGS,
	PRODUCTS_INDEX,
	PRODUCTS_REBUILD_INDEX,
	PRODUCTS_SETTINGS,
	SUGGESTIONS_INDEX,
	SUGGESTIONS_SETTINGS
} from '../src/lib/server/search-index/settings.ts';
import { buildSuggestions } from '../src/lib/server/search-index/suggestions.ts';
import {
	fetchBrandDocuments,
	fetchCategoryDocuments,
	fetchProductBatch,
	loadIndexContext,
	type ProductScope
} from '../src/lib/server/search-index/documents.ts';

/** Produits lus par requête SQL et envoyés par requête Meilisearch. */
const BATCH = 10_000;

/** Envois en attente au plus : au-delà, on laisse Meilisearch absorber. */
const MAX_PENDING = 8;

/** L'indexation d'un million de documents se compte en dizaines de minutes. */
const LONG_WAIT = { timeout: 2 * 60 * 60 * 1000, interval: 2000 };

/** Nom de la clé créée par `--setup`, pour ne pas la recréer à chaque passage. */
const APP_KEY_NAME = 'msshop-app';

/** Index que l'application interroge et met à jour. */
const APP_INDEXES = [PRODUCTS_INDEX, CATEGORIES_INDEX, BRANDS_INDEX, SUGGESTIONS_INDEX];

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) ?? 'reindex';
const setup = args.includes('--setup');
const sinceArg = args.find((a) => a.startsWith('--since='))?.split('=')[1] ?? '26h';

const client = new Meilisearch({
	host: requireEnv('MEILI_URL'),
	apiKey: requireEnv('MEILI_MASTER_KEY')
});
const sql = targetDb();

/** Nouvelles tentatives sur erreur réseau, espacées de plus en plus. */
const RETRIES = 5;

/**
 * Rejoue une opération sur coupure passagère. Sur un parcours d'un million de
 * produits, une connexion qui expire une fois (Railway, réseau local) ne doit
 * pas faire perdre dix minutes d'envoi.
 */
async function retry<T>(label: string, operation: () => Promise<T>): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await operation();
		} catch (error) {
			if (attempt >= RETRIES) throw error;
			const cause = error instanceof Error ? (error.cause ?? error.message) : error;
			log.warn(`${label} : échec (${String(cause)}), nouvelle tentative ${attempt}/${RETRIES - 1}`);
			await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
		}
	}
}

/** Envoie une tâche à Meilisearch ; renvoie son numéro dès qu'elle est acceptée. */
async function enqueue(label: string, send: () => EnqueuedTaskPromise): Promise<number> {
	return retry(label, async () => (await send()).taskUid);
}

/** Attend une tâche et échoue franchement si Meilisearch l'a refusée. */
async function settle(taskUid: number, label: string) {
	const done = await retry(label, () => client.tasks.waitForTask(taskUid, LONG_WAIT));
	if (done.status !== 'succeeded') {
		throw new Error(`${label} : tâche ${done.uid} ${done.status} — ${done.error?.message ?? ''}`);
	}
	return done;
}

/** Envoie une tâche et attend qu'elle soit traitée. */
async function run(label: string, send: () => EnqueuedTaskPromise) {
	return settle(await enqueue(label, send), label);
}

async function ensureIndex(uid: string, settings: Settings) {
	const exists = await client
		.getRawIndex(uid)
		.then(() => true)
		.catch(() => false);
	if (!exists) await run(`création ${uid}`, () => client.createIndex(uid, { primaryKey: 'id' }));
	await run(`réglages ${uid}`, () => client.index(uid).updateSettings(settings));
}

/**
 * Rayons, marques et suggestions : quelques dizaines de milliers de documents
 * au plus, recalculés en entier et remplacés d'un coup.
 */
async function rebuildSmallIndexes() {
	const ctx = await loadIndexContext(sql);
	const [categories, brands, suggestions] = await Promise.all([
		fetchCategoryDocuments(sql, ctx),
		fetchBrandDocuments(sql),
		retry('calcul des suggestions', () => buildSuggestions(sql, ctx))
	]);

	for (const [uid, settings, docs] of [
		[CATEGORIES_INDEX, CATEGORIES_SETTINGS, categories],
		[BRANDS_INDEX, BRANDS_SETTINGS, brands],
		[SUGGESTIONS_INDEX, SUGGESTIONS_SETTINGS, suggestions]
	] as const) {
		await ensureIndex(uid, settings);
		await run(`vidage ${uid}`, () => client.index(uid).deleteAllDocuments());
		await run(`documents ${uid}`, () => client.index(uid).addDocuments([...docs]));
		log.success(`${uid} : ${count(docs.length)} documents`);
	}
}

type ProductBatch = Awaited<ReturnType<typeof fetchProductBatch>>;

/** Envoie tous les produits d'une sélection dans `indexUid`, lot par lot. */
async function pushProducts(indexUid: string, firstScope: ProductScope, total: number) {
	const ctx = await loadIndexContext(sql);
	log.muted(`${count(ctx.sales.size)} produits vendus au moins une fois`);

	const index = client.index(indexUid);
	const bar = progress('Produits envoyés', total);
	const pending: { taskUid: number; label: string }[] = [];
	let scope: ProductScope | null = firstScope;
	let sent = 0;
	let removed = 0;

	while (scope) {
		const current: ProductScope = scope;
		const batch: ProductBatch = await retry('lecture des produits', () =>
			fetchProductBatch(sql, ctx, current)
		);
		if (batch.documents.length > 0) {
			const label = 'ajout produits';
			pending.push({
				taskUid: await enqueue(label, () => index.addDocuments(batch.documents)),
				label
			});
		}
		if (batch.inactiveIds.length > 0) {
			const label = 'retrait inactifs';
			pending.push({
				taskUid: await enqueue(label, () => index.deleteDocuments(batch.inactiveIds)),
				label
			});
		}
		sent += batch.documents.length;
		removed += batch.inactiveIds.length;
		bar.tick(sent + removed);

		while (pending.length > MAX_PENDING) {
			const { taskUid, label } = pending.shift()!;
			await settle(taskUid, label);
		}
		scope = batch.lastId !== null && 'limit' in scope ? { ...scope, afterId: batch.lastId } : null;
	}

	bar.done(sent);
	if (removed > 0) log.info(`${count(removed)} produits inactifs retirés`);

	const started = Date.now();
	log.step('Indexation par Meilisearch…');
	for (const { taskUid, label } of pending) await settle(taskUid, label);
	log.success(`Indexation terminée en ${duration(Date.now() - started)}`);
	return sent;
}

async function reindex() {
	log.title(`Reconstruction de l'index de recherche — ${targetLabel()}`);

	// Le parcours lit tout le catalogue ; les inactifs sont écartés au passage.
	const [{ total, active }] = await sql<{ total: number; active: number }[]>`
		SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active FROM product
	`;
	log.info(`${count(active)} produits actifs à indexer sur ${count(total)}`);

	await client.deleteIndexIfExists(PRODUCTS_REBUILD_INDEX);
	await ensureIndex(PRODUCTS_REBUILD_INDEX, PRODUCTS_SETTINGS);
	const sent = await pushProducts(PRODUCTS_REBUILD_INDEX, { afterId: 0, limit: BATCH }, total);

	const stats = await client.index(PRODUCTS_REBUILD_INDEX).getStats();
	if (stats.numberOfDocuments !== sent) {
		throw new Error(
			`${count(stats.numberOfDocuments)} documents indexés pour ${count(sent)} envoyés : bascule annulée`
		);
	}

	// La bascule exige que les deux index existent.
	await ensureIndex(PRODUCTS_INDEX, PRODUCTS_SETTINGS);
	await run('bascule', () =>
		client.swapIndexes([{ indexes: [PRODUCTS_INDEX, PRODUCTS_REBUILD_INDEX], rename: false }])
	);
	await client.deleteIndexIfExists(PRODUCTS_REBUILD_INDEX);
	log.success(`Index « ${PRODUCTS_INDEX} » basculé : ${count(sent)} produits`);

	await rebuildSmallIndexes();
}

/** Durée « 26h », « 7d », « 90m » → date de début de la fenêtre. */
function parseSince(value: string): Date {
	const match = /^(\d+)([mhd])$/.exec(value);
	if (!match) throw new Error(`--since invalide : « ${value} » (attendu : 90m, 26h, 7d)`);
	const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 'm' | 'h' | 'd'];
	return new Date(Date.now() - Number(match[1]) * unit);
}

async function sync() {
	const since = parseSince(sinceArg);
	log.title(`Rattrapage de l'index : produits modifiés depuis ${since.toLocaleString('fr-FR')}`);

	const [{ total }] = await sql<{ total: number }[]>`
		SELECT count(*)::int AS total FROM product WHERE updated_at >= ${since}
	`;
	if (total === 0) log.info('Aucun produit modifié.');
	else await pushProducts(PRODUCTS_INDEX, { updatedSince: since, afterId: 0, limit: BATCH }, total);

	await rebuildSmallIndexes();
}

/** Réglages seuls : synonymes, mots vides, classement — sans renvoyer un document. */
async function settings() {
	log.title('Mise à jour des réglages de recherche');
	for (const [uid, value] of [
		[PRODUCTS_INDEX, PRODUCTS_SETTINGS],
		[CATEGORIES_INDEX, CATEGORIES_SETTINGS],
		[BRANDS_INDEX, BRANDS_SETTINGS],
		[SUGGESTIONS_INDEX, SUGGESTIONS_SETTINGS]
	] as const) {
		await ensureIndex(uid, value);
		log.success(`${uid} : réglages appliqués`);
	}
}

/**
 * Clé de l'application : recherche et mise à jour des documents, sur les
 * seuls index de la boutique. Affichée une fois, à copier dans `.env`.
 *
 * Meilisearch ne permet pas d'étendre une clé à un nouvel index : une clé qui
 * n'en couvre pas un (ajout de `suggestions`) est supprimée et recréée — la
 * nouvelle valeur doit alors remplacer l'ancienne partout où elle est déclarée.
 */
async function createAppKey() {
	const { results } = await client.getKeys({ limit: 100 });
	const existing = results.find((k) => k.name === APP_KEY_NAME);
	if (existing && APP_INDEXES.every((uid) => existing.indexes.includes(uid))) {
		log.info(`La clé « ${APP_KEY_NAME} » existe déjà et couvre tous les index.`);
		return;
	}
	if (existing) {
		await client.deleteKey(existing.uid);
		log.warn(`Ancienne clé « ${APP_KEY_NAME} » supprimée : elle ne couvrait pas tous les index.`);
	}

	const key = await client.createKey({
		name: APP_KEY_NAME,
		description: 'Boutique MSShop : recherche et synchronisation des fiches',
		actions: ['search', 'documents.add', 'documents.delete', 'tasks.get'],
		indexes: APP_INDEXES,
		expiresAt: null
	});
	log.title('Clé applicative créée — à reporter dans .env (et en production) :');
	console.log(`MEILI_API_KEY="${key.key}"`);
}

const started = Date.now();
try {
	if (command === 'reindex') await reindex();
	else if (command === 'sync') await sync();
	else if (command === 'settings') await settings();
	else if (command === 'suggestions') await rebuildSmallIndexes();
	else throw new Error(`Commande inconnue : ${command} (reindex, sync, settings, suggestions)`);

	if (setup) await createAppKey();
	log.success(`Terminé en ${duration(Date.now() - started)}`);
} catch (error) {
	log.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
} finally {
	await closeTargetDb();
}

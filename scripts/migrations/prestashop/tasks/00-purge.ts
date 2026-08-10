/**
 * Étape 5 du cahier des charges — purge du catalogue dans la base **cible**.
 *
 * Vide les tables catalogue pour permettre un import propre depuis PrestaShop.
 * Les commandes, clients et comptes ne sont **pas** touchés.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  ⚠️ Pourquoi ce n'est plus un `TRUNCATE ... CASCADE`
 *
 *  La version initiale faisait `TRUNCATE product, category, … CASCADE`. Vérifié
 *  sur sakura le 2026-08-08 : **cela aurait détruit les 51 525 lignes de
 *  `order_line`**, soit l'historique de vente de 27 403 commandes — alors même
 *  que ce fichier promet de ne pas toucher aux commandes.
 *
 *  En effet, `TRUNCATE ... CASCADE` **ignore les règles `ON DELETE`** : il vide
 *  brutalement toute table qui référence la cible, quelle que soit sa clause.
 *
 *  Or le schéma est correct : `order_line.product_id` est `ON DELETE SET NULL`,
 *  et chaque ligne conserve `product_name` (51 525/51 525) et
 *  `product_reference` (51 506/51 525). Les commandes sont donc **autonomes** :
 *  un `DELETE` les préserve intégralement, en mettant seulement le lien à NULL.
 *
 *  On utilise donc `DELETE`, plus lent mais qui **respecte les FK**. Les
 *  séquences sont remises à zéro séparément.
 * ────────────────────────────────────────────────────────────────────────────
 */
import type { Task } from '../../../lib/runner.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count, progress } from '../../../lib/logger.ts';

/**
 * Taille des lots de suppression.
 *
 * Chaque lot est validé immédiatement : la purge est ainsi **reprenable** et
 * affiche une progression, au lieu de rester figée plusieurs minutes sur une
 * transaction unique qu'une interruption annulerait entièrement.
 */
const DELETE_BATCH = 20_000;

/**
 * Tables vidées, **dans l'ordre des dépendances** (enfants avant parents) :
 * sans CASCADE, l'ordre devient significatif.
 */
const CATALOG_TABLES = [
	'product_relation',
	'product_category',
	'product_media',
	'stock_movement',
	'product_variant',
	'product',
	'category'
] as const;

/**
 * Domaine commandes — purgé uniquement avec `--with-orders`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Pourquoi c'est nécessaire avant de rejouer `customers` / `orders`
 *
 *  Les 27 403 commandes et 24 480 clients présents viennent de la chaîne
 *  `metro`, qui a perdu des données (§6.9) : 122 194 entrées d'historique,
 *  24 337 factures et 24 350 paiements totalement absents.
 *
 *  Sans purge, les tâches étant idempotentes par `legacy_ps_id`, elles
 *  **ignoreraient** ces lignes et n'importeraient que les 1 179 commandes
 *  manquantes. Résultat : deux qualités de données mélangées dans la même
 *  table, impossibles à distinguer ensuite.
 *
 *  Deux vrais doublons apparaîtraient en plus :
 *   - `order_state` : les 14 statuts existants n'ont **aucun** `legacy_ps_id`,
 *     donc 32 nouveaux s'ajouteraient → 46 statuts dont 14 orphelins ;
 *   - `order_state_history` : pas de `legacy_ps_id` du tout, donc les 27 403
 *     entrées tronquées seraient conservées au lieu des 149 597 réelles.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `user` n'est PAS purgée : elle porte les comptes better-auth (sessions,
 * mots de passe, comptes admin). `customer` référence `user` en `ON DELETE
 * CASCADE`, donc supprimer un `user` supprimerait le client — jamais l'inverse.
 * Les comptes réimportés réutilisent l'id déterministe `ps-<id_customer>`.
 */
const ORDER_TABLES = [
	'order_payment',
	'order_invoice',
	'order_state_history',
	'order_line',
	'cart_item',
	'cart',
	'order',
	'address',
	'customer',
	'order_state'
] as const;

/**
 * Tables hors périmètre qui référencent le catalogue, et dont les lignes
 * doivent **survivre** à une purge catalogue seule. Vérifiées avant et après.
 */
const PROTECTED = ['order_line', 'cart_item'] as const;

export const purgeTask: Task = {
	name: 'purge',
	description: 'Vide le catalogue (+ commandes avec --with-orders)',

	async run({ dryRun, options }) {
		const sql = targetDb();

		// Les commandes ne sont purgées que sur demande explicite : ce sont des
		// données de vente, et leur suppression est irréversible.
		const withOrders = options['with-orders'] === true;
		const TABLES = withOrders ? [...CATALOG_TABLES, ...ORDER_TABLES] : [...CATALOG_TABLES];

		const counts = await sql.unsafe<{ table_name: string; n: number }[]>(
			TABLES.map((t) => `SELECT '${t}' AS table_name, COUNT(*)::int AS n FROM "${t}"`).join(
				' UNION ALL '
			)
		);
		const before = counts;

		if (withOrders) {
			log.warn('⚠️  --with-orders : le domaine COMMANDES sera purgé aussi.');
		} else {
			log.muted('catalogue seul (ajouter --with-orders pour purger aussi les commandes)');
		}
		for (const row of before) log.muted(`${row.table_name.padEnd(20)} ${count(row.n)}`);

		const total = before.reduce((sum, r) => sum + r.n, 0);

		// --- Garde-fou : état des tables à protéger, AVANT ---
		// Sans `--with-orders`, les commandes doivent survivre intactes. Avec, le
		// contrôle n'a plus lieu d'être : on les supprime volontairement.
		const protectedBefore = new Map<string, number>();
		if (!withOrders) {
			for (const table of PROTECTED) {
				const [row] = await sql.unsafe<{ n: number }[]>(
					`SELECT COUNT(*)::int AS n FROM "${table}"`
				);
				protectedBefore.set(table, Number(row.n));
			}
			log.info('Tables préservées (commandes, paniers) :');
			for (const [table, n] of protectedBefore) {
				log.muted(`  ${table.padEnd(18)} ${count(n)} lignes — doivent survivre`);
			}
		} else {
			// ── `user` : suppression ciblée des comptes CLIENTS ────────────────
			//
			//  Mesuré le 2026-08-10 : les 24 480 comptes clients créés par `metro`
			//  ont des ids **aléatoires** (`XoTIf9rfz7kPRuSneTBOBQ5dYhTBgVFz`), pas
			//  le format déterministe `ps-<id_customer>` qu'utilise `customers`.
			//
			//  Les laisser en place produirait ~50 000 comptes dont la moitié
			//  orphelins — et surtout, leurs emails étant déjà pris, la
			//  déduplication suffixerait **tous** les clients réimportés en
			//  `+psID`, rendant chaque adresse fausse.
			//
			//  On supprime donc les comptes rattachés à un `customer`, en
			//  préservant tout le reste : admins, comptes internes, et tout compte
			//  sans fiche client.
			const [u] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "user"`;
			const [clients] = await sql<{ n: number }[]>`
				SELECT COUNT(*)::int AS n FROM "user" u
				 WHERE EXISTS (SELECT 1 FROM customer c WHERE c.user_id = u.id)`;
			log.warn(
				`« user » : ${count(Number(clients.n))} comptes clients supprimés, ` +
					`${count(Number(u.n) - Number(clients.n))} conservés (admins et comptes internes).`
			);
		}

		if (dryRun) {
			log.warn(`Simulation : ${count(total)} lignes auraient été supprimées.`);
			log.muted(
				withOrders
					? '  (catalogue + commandes ; seuls les comptes NON clients sont conservés)'
					: '  (DELETE ordonné, pas TRUNCATE CASCADE : les commandes sont conservées)'
			);
			return { processed: 0, note: 'simulation' };
		}

		// `DELETE` et non `TRUNCATE ... CASCADE` : ce dernier ignore les règles
		// `ON DELETE` et viderait `order_line` (51 525 lignes).
		//
		// ── Par lots, et NON dans une transaction unique ────────────────────
		//  Une seule transaction sur 1,8 M de lignes n'a aucun point de reprise :
		//  la moindre interruption (Ctrl+C, coupure réseau, fermeture du
		//  terminal) annule tout le travail déjà fait. C'est arrivé le
		//  2026-08-08 après ~9 minutes de suppression, entièrement perdues.
		//
		//  Chaque lot est donc validé immédiatement. La purge devient
		//  **reprenable** : relancer la tâche continue là où elle s'est arrêtée,
		//  ce qui est sans risque puisque l'objectif est de tout vider.
		const sizeBefore = new Map(before.map((r) => [String(r.table_name), Number(r.n)]));

		// Comptes clients à supprimer, relevés AVANT que `customer` ne soit vidée :
		// c'est la seule chose qui permet de distinguer un compte client d'un
		// compte admin. Après la purge, l'information serait perdue.
		let clientUserIds: string[] = [];
		if (withOrders) {
			const rows = await sql<{ id: string }[]>`
				SELECT u.id FROM "user" u
				 WHERE EXISTS (SELECT 1 FROM customer c WHERE c.user_id = u.id)`;
			clientUserIds = rows.map((r) => r.id);
		}

		for (const table of TABLES) {
			let deleted = 0;
			const bar = progress(table, sizeBefore.get(table) ?? 0);
			for (;;) {
				// `ctid` : identifiant physique de ligne, utilisable même sans
				// clé primaire exploitable, et sans tri coûteux.
				const result = await sql.unsafe(
					`DELETE FROM "${table}"
					  WHERE ctid = ANY(ARRAY(
					        SELECT ctid FROM "${table}" LIMIT ${DELETE_BATCH}
					  ))`
				);
				if (result.count === 0) break;
				deleted += result.count;
				bar.tick(deleted);
			}
			bar.done(deleted);
			log.muted(`  ${table.padEnd(18)} ${count(deleted)} lignes supprimées`);
		}

		// Comptes clients, une fois `customer` vidée. Les sessions et `account`
		// liés partent en CASCADE — c'est voulu : ces comptes n'existent plus.
		if (withOrders && clientUserIds.length > 0) {
			let removed = 0;
			const ubar = progress('user (clients)', clientUserIds.length);
			for (let i = 0; i < clientUserIds.length; i += DELETE_BATCH) {
				const result = await sql`
					DELETE FROM "user" WHERE id = ANY(${clientUserIds.slice(i, i + DELETE_BATCH)})`;
				removed += result.count;
				ubar.tick(removed);
			}
			ubar.done(removed);
			log.muted(`  ${'user (clients)'.padEnd(18)} ${count(removed)} comptes supprimés`);
		}

		// Séquences remises à 1 : les `id` repartent de zéro, ce qui garde des
		// URLs `id-slug` courtes. `TRUNCATE` le faisait via RESTART IDENTITY.
		//
		// L'existence de la colonne `id` est vérifiée AVANT d'appeler
		// `pg_get_serial_sequence` : cette fonction lève une erreur si la colonne
		// n'existe pas, et un `WHERE` ne protège de rien — Postgres l'évalue de
		// toute façon. `product_category` est une table de liaison pure
		// (`product_id`, `category_id`) et n'a donc pas d'`id`.
		for (const table of TABLES) {
			const [col] = await sql<{ exists: boolean }[]>`
				SELECT EXISTS (
					SELECT 1 FROM information_schema.columns
					 WHERE table_name = ${table} AND column_name = 'id'
				) AS exists`;
			if (!col.exists) {
				log.muted(`  ${table.padEnd(18)} pas de colonne id — aucune séquence à réinitialiser`);
				continue;
			}

			await sql.unsafe(
				`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), 1, false)`
			);
		}

		// --- Garde-fou : les tables protégées ont-elles survécu ? ---
		// Uniquement en purge catalogue : avec `--with-orders`, leur suppression
		// est justement l'objectif.
		if (!withOrders) {
			for (const table of PROTECTED) {
				const [row] = await sql.unsafe<{ n: number }[]>(
					`SELECT COUNT(*)::int AS n FROM "${table}"`
				);
				const avant = protectedBefore.get(table) ?? 0;
				const apres = Number(row.n);
				if (apres !== avant) {
					throw new Error(
						`PURGE ANORMALE : « ${table} » est passée de ${avant} à ${apres} lignes. ` +
							'Les commandes devaient être préservées — vérifier immédiatement.'
					);
				}
				log.success(`${table} intacte : ${count(apres)} lignes`);
			}
		} else {
			// Contrôle inverse : les comptes NON clients doivent avoir survécu.
			// Un admin perdu, c'est l'accès au back-office perdu.
			const [u] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "user"`;
			const [a] = await sql<{ n: number }[]>`
				SELECT COUNT(*)::int AS n FROM "user" WHERE role = 'admin'`;
			if (Number(a.n) === 0) {
				throw new Error(
					'PURGE ANORMALE : plus aucun compte admin en base. ' +
						'Le back-office serait inaccessible — vérifier immédiatement.'
				);
			}
			log.success(
				`${count(Number(u.n))} comptes conservés, dont ${count(Number(a.n))} admin(s)`
			);
		}

		log.info(`${count(total)} lignes supprimées, séquences réinitialisées.`);
		return {
			processed: total,
			note: withOrders ? 'catalogue + commandes purgés' : 'commandes préservées'
		};
	}
};

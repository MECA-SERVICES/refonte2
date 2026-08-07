/**
 * Service de migration PrestaShop → base projet — **étape 4** du cahier des
 * charges (`MIGRATION-CATALOGUE.md`).
 *
 *     prod5 (MariaDB, via tunnel SSH)  ──►  DATABASE_URL / sakura (PostgreSQL)
 *            LECTURE SEULE                        purge + import
 *
 * Remplace `scripts/migration/`, qui lisait la base intermédiaire `metro`
 * (hors périmètre depuis la décision du 2026-08-07, §2.4).
 *
 * ── Utilisation ────────────────────────────────────────────────────────────
 *
 *     bun run migrate:ps -- --list          # liste les tâches
 *     bun run migrate:ps -- --dry-run       # simulation, aucune écriture
 *     bun run migrate:ps -- --only=verify   # contrôles de recette seuls
 *     bun run migrate:ps -- --only=products --limit=1000
 *     bun run migrate:ps -- --from=products # reprise après interruption
 *     bun run migrate:ps                    # migration complète
 *
 * ── Garde-fous ─────────────────────────────────────────────────────────────
 *
 *  - la source est **strictement en lecture seule**, imposée par le code
 *    (`assertReadOnly` dans `source-db.ts`), pas par convention ;
 *  - `purge` n'est **jamais** jouée par défaut : elle détruit le catalogue
 *    cible et doit être demandée explicitement (`--only=purge`), après la
 *    sauvegarde de l'étape 0 ;
 *  - toutes les tâches sont **idempotentes** par `legacy_ps_id` : une
 *    interruption se reprend sans doublon.
 *
 * ── Exécution : `node`, pas `bun` ──────────────────────────────────────────
 *
 *  Le cache bun a une résolution cassée sur `iconv-lite` → `safer-buffer`,
 *  dépendance de `mysql2` (§2.1). Les scripts `migrate:ps*` du package.json
 *  passent donc par `node --experimental-strip-types`.
 */
import { runTasks } from '../../lib/runner.ts';
import { closeSourceDb } from './source-db.ts';
import { closeTargetDb, targetLabel } from '../../lib/target-db.ts';
import { log } from '../../lib/logger.ts';

import { purgeTask } from './tasks/00-purge.ts';
import { brandsTask } from './tasks/01-brands.ts';
import { categoriesTask } from './tasks/02-categories.ts';
import { productsTask } from './tasks/03-products.ts';
import { productCategoriesTask } from './tasks/04-product-categories.ts';
import { mediaTask } from './tasks/05-media.ts';
import { variantsTask } from './tasks/06-variants.ts';
import { verifyTask } from './tasks/07-verify.ts';

/**
 * Ordre d'import, dicté par les dépendances de clés étrangères :
 * marques et catégories d'abord (les produits s'y rattachent), puis les
 * produits, puis tout ce qui pend aux produits.
 *
 * `purge` est volontairement **absente** de cette liste : elle est destructive
 * et ne doit jamais partir avec la migration complète. Elle reste accessible
 * par `--only=purge`.
 */
const tasks = [
	brandsTask,
	categoriesTask,
	productsTask,
	productCategoriesTask,
	mediaTask,
	variantsTask,
	verifyTask
];

/** Tâches destructives, jouables uniquement en `--only`. */
const guarded = [purgeTask];

const requested = process.argv.slice(2);
const isOnly = requested.some((a) => a.startsWith('--only='));
const isList = requested.includes('--list');

// `purge` n'est proposée au runner que si l'utilisateur la nomme explicitement.
const available = isOnly || isList ? [...guarded, ...tasks] : tasks;

if (!isList) {
	log.muted(`cible : ${targetLabel()}`);
}

await runTasks({
	title: 'Migration PrestaShop → msshopv2',
	tasks: available,
	cleanup: async () => {
		await closeSourceDb();
		await closeTargetDb();
	}
});

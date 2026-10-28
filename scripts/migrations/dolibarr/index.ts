/**
 * Reprise Dolibarr → base projet : remplacement de Dolibarr par MSShop
 * (`MIGRATION-DOLIBARR.md`).
 *
 *     doli_bdd1 (MariaDB, via tunnel SSH)  ──►  DATABASE_URL (PostgreSQL)
 *            LECTURE SEULE                        import idempotent
 *
 * Principe : un seul système. Les données Dolibarr se rattachent aux produits
 * et clients existants de MSShop (par référence, EAN, e-mail, SIRET) ; elles
 * ne créent pas de catalogue ni de fichier client à part. Chaque ligne reprise
 * porte son `legacy_doli_id`.
 *
 * ── Utilisation ────────────────────────────────────────────────────────────
 *
 *     bun run migrate:doli -- --list
 *     bun run migrate:doli:dry                 # simulation, aucune écriture
 *     bun run migrate:doli -- --only=locations
 *     bun run migrate:doli -- --only=stock
 *
 * Exécution par `node`, pas `bun` : même raison que la reprise PrestaShop
 * (résolution de `mysql2` cassée dans le cache bun).
 */
import { runTasks } from '../../lib/runner.ts';
import { closeSourceDb } from './source.ts';
import { closeTargetDb, targetLabel } from '../../lib/target-db.ts';
import { log } from '../../lib/logger.ts';

import { locationsTask } from './tasks/01-locations.ts';
import { stockTask } from './tasks/02-stock.ts';

/** Ordre d'import, dicté par les dépendances : les emplacements avant le stock. */
const tasks = [locationsTask, stockTask];

if (!process.argv.includes('--list')) {
	log.muted(`cible : ${targetLabel()}`);
}

await runTasks({
	title: 'Reprise Dolibarr → msshopv2',
	tasks,
	cleanup: async () => {
		await closeSourceDb();
		await closeTargetDb();
	}
});

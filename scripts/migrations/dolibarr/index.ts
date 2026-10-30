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
import { productsTask } from './tasks/02-products.ts';
import { stockTask } from './tasks/03-stock.ts';
import { serialsTask } from './tasks/04-serials.ts';
import { inventoriesTask } from './tasks/05-inventories.ts';
import { vouchersTask } from './tasks/06-vouchers.ts';
import { customersTask } from './tasks/07-customers.ts';
import { invoicesTask } from './tasks/08-invoices.ts';
import { remittancesTask } from './tasks/09-remittances.ts';
import { quotesTask } from './tasks/10-quotes.ts';
import { suppliersTask } from './tasks/11-suppliers.ts';
import { contactsTask } from './tasks/12-contacts.ts';
import { teamTask } from './tasks/13-team.ts';
import { creditsTask } from './tasks/14-credits.ts';
import { fixedAssetsTask } from './tasks/15-fixed-assets.ts';
import { interventionsTask } from './tasks/16-interventions.ts';
import { leavesTask } from './tasks/17-leaves.ts';
import { agendaTask } from './tasks/18-agenda.ts';

/** Ordre d'import, dicté par les dépendances : emplacements et produits avant le stock. */
const tasks = [
	locationsTask,
	productsTask,
	stockTask,
	serialsTask,
	inventoriesTask,
	vouchersTask,
	customersTask,
	invoicesTask,
	remittancesTask,
	quotesTask,
	suppliersTask,
	contactsTask,
	teamTask,
	creditsTask,
	fixedAssetsTask,
	interventionsTask,
	leavesTask,
	agendaTask
];

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

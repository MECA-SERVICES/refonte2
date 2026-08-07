/**
 * Étape 5 du cahier des charges — purge du catalogue dans la base **cible**.
 *
 * Vide les tables catalogue pour permettre un import propre depuis PrestaShop.
 * Les commandes, clients et comptes ne sont **pas** touchés.
 *
 * `TRUNCATE ... RESTART IDENTITY CASCADE` remet aussi les séquences à zéro :
 * les `id` repartent de 1, ce qui garde des URLs `id-slug` courtes.
 */
import type { Task } from '../../../lib/runner.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count } from '../../../lib/logger.ts';

/** Tables vidées, dans un ordre sans importance grâce à CASCADE. */
const TABLES = [
	'product_relation',
	'product_category',
	'product_media',
	'stock_movement',
	'product_variant',
	'product',
	'category'
] as const;

export const purgeTask: Task = {
	name: 'purge',
	description: 'Vide le catalogue cible (produits, catégories, médias, variantes)',

	async run({ dryRun }) {
		const sql = targetDb();

		const before = await sql<{ table_name: string; n: number }[]>`
			SELECT 'product' AS table_name, COUNT(*)::int AS n FROM product
			UNION ALL SELECT 'category', COUNT(*)::int FROM category
			UNION ALL SELECT 'product_media', COUNT(*)::int FROM product_media
			UNION ALL SELECT 'product_category', COUNT(*)::int FROM product_category
			UNION ALL SELECT 'product_variant', COUNT(*)::int FROM product_variant`;

		for (const row of before) log.muted(`${row.table_name.padEnd(18)} ${count(row.n)}`);

		const total = before.reduce((sum, r) => sum + r.n, 0);

		if (dryRun) {
			log.warn(`Simulation : ${count(total)} lignes auraient été supprimées.`);
			return { processed: 0, note: 'simulation' };
		}

		// Un seul TRUNCATE multi-tables : atomique, et évite les contrôles de FK
		// intermédiaires que ferait une suite de DELETE.
		await sql.unsafe(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);

		log.info(`${count(total)} lignes supprimées, séquences réinitialisées.`);
		return { processed: total };
	}
};

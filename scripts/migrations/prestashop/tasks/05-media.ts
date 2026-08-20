/**
 * Import des images : `ps_image` → `product_media`.
 *
 * Version ONE-BY-ONE : résolution product_id individuellement, sans JOIN.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery, sourceCursor } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { productImageUrl, imageBaseUrl } from '../media-url.ts';
import { text } from '../../../lib/transform.ts';
import { log, count, progress } from '../../../lib/logger.ts';

const ID_LANG = 1;
const BATCH_SIZE = 100; // Lire 100 à la fois de PrestaShop

interface SourceImage {
	[key: string]: unknown;
	id_image: number;
	id_product: number;
	position: number;
	cover: number | null;
	legend: string | null;
}

export const mediaTask: Task = {
	name: 'media',
	description: 'Images produits (ps_image → product_media)',
	dependsOn: ['products'],

	async run({ dryRun, limit }) {
		const sql = targetDb();

		const [{ total }] = await sourceQuery<{ total: number }>(
			'SELECT COUNT(*) AS total FROM ps_image'
		);
		const expected = limit ?? Number(total);
		log.muted(`${count(Number(total))} images en source`);
		log.muted(`base d'URL : ${imageBaseUrl()}`);

		if (dryRun) {
			log.warn(`Simulation : ${count(expected)} images`);
			return { processed: 0, note: 'simulation' };
		}

		const bar = progress('images', expected);
		let read = 0;
		let inserted = 0;
		let orphans = 0;

		const select = `
			SELECT i.id_image, i.id_product, i.position, i.cover, il.legend
			  FROM ps_image i
			  LEFT JOIN ps_image_lang il ON il.id_image = i.id_image AND il.id_lang = ${ID_LANG}
			 WHERE 1 = 1 {{WHERE}}`;

		const pageSize = limit === null ? BATCH_SIZE : Math.min(BATCH_SIZE, limit);

		for await (const rows of sourceCursor<SourceImage>(select, 'i.id_image', pageSize)) {
			// Récupérer les legacy_ps_id de ce batch
			const legacyProductIds = [...new Set(rows.map((r) => Number(r.id_product)))];

			// Résoudre les product_id en UNE requête simple (WHERE IN)
			const productMap = await sql<{ id: number; legacy_ps_id: number }[]>`
				SELECT id, legacy_ps_id FROM product
				WHERE legacy_ps_id = ANY(${legacyProductIds})`;

			const legacyToId = new Map(productMap.map((p) => [Number(p.legacy_ps_id), Number(p.id)]));

			// Préparer batch final
			const batch = [];
			for (const r of rows) {
				const productId = legacyToId.get(Number(r.id_product));
				if (!productId) {
					orphans++;
					continue;
				}

				batch.push({
					product_id: productId,
					type: 'image' as const,
					url: productImageUrl(Number(r.id_image)),
					alt: text(r.legend),
					position: r.cover ? 0 : Number(r.position) || 0,
					legacy_ps_id: Number(r.id_image)
				});
			}

			// Insertion directe simple
			if (batch.length > 0) {
				const result = await sql`
					INSERT INTO product_media ${sql(batch)}
					ON CONFLICT (legacy_ps_id) WHERE legacy_ps_id IS NOT NULL DO NOTHING`;
				inserted += result.count;
			}

			read += rows.length;
			bar.tick(read);
			if (limit !== null && read >= limit) break;
		}

		bar.done(inserted);

		return {
			processed: inserted,
			note: orphans > 0 ? `${count(orphans)} non rattachées` : undefined
		};
	}
};

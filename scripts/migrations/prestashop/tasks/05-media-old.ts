/**
 * Import des images : `ps_image` (+ `ps_image_lang` pour l'alt) → `product_media`.
 *
 * 568 712 images en source (contrôle de recette n°9).
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Stockage des fichiers — état transitoire assumé
 *
 *  Le bucket R2 n'existe pas encore. On importe donc les **URL de l'ancien
 *  site**, reconstruites depuis l'`id_image` (PrestaShop ne stocke pas d'URL,
 *  il dérive un chemin éclaté — voir `../media-url.ts`).
 *
 *  `product_media.legacy_ps_id` conserve l'`id_image` source. La reprise vers
 *  R2 sera donc un simple parcours de `product_media` :
 *
 *      SELECT id, url FROM product_media WHERE url LIKE 'https://www.mecaservicesshop.fr/%'
 *      → télécharger, pousser sur R2, UPDATE product_media SET url = ...
 *
 *  Aucun retour à la base PrestaShop ne sera nécessaire — ce qui compte, la
 *  source étant en lecture seule derrière un tunnel SSH.
 * ────────────────────────────────────────────────────────────────────────────
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery, sourceCursor } from '../source-db.ts';
import { targetDb, insertBatched } from '../../../lib/target-db.ts';
import { productImageUrl, imageBaseUrl } from '../media-url.ts';
import { text } from '../../../lib/transform.ts';
import { log, count, progress } from '../../../lib/logger.ts';

/** Langue française dans PrestaShop. */
const ID_LANG = 1;

const PAGE_SIZE = 20_000;

// `sourceCursor` exige une index signature (contrainte
// `Record<string, unknown>`) : les lignes MySQL sont indexées par nom
// de colonne.
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
		log.muted(`base d'URL : ${imageBaseUrl()} (surchargeable via PS_IMAGE_BASE_URL)`);

		if (dryRun) {
			log.warn(`Simulation : ${count(expected)} images auraient été importées.`);
			log.muted(`exemple d'URL générée : ${productImageUrl(568712)}`);
			return { processed: 0, note: 'simulation' };
		}

		// Idempotence : charger les images déjà importées pour les skip
		const importedRows = await sql<{ legacy_ps_id: number }[]>`
			SELECT legacy_ps_id FROM product_media WHERE legacy_ps_id IS NOT NULL`;
		const alreadyImported = new Set(importedRows.map((r) => Number(r.legacy_ps_id)));
		if (alreadyImported.size > 0) {
			log.muted(`${count(alreadyImported.size)} images déjà importées — elles seront ignorées`);
		}

		// Charger le mapping legacy_ps_id → product.id une fois en mémoire.
		// 1,05 M de couples (int, int) ≈ 16 Mo, acceptable, et cela évite une
		// transaction unique bloquante sur 568k images.
		const productRows = await sql<{ id: number; legacy_ps_id: number }[]>`
			SELECT id, legacy_ps_id FROM product WHERE legacy_ps_id IS NOT NULL`;
		const productByLegacy = new Map(productRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)]));
		log.muted(`${count(productByLegacy.size)} produits mappés`);

		const bar = progress('images', expected);
		let read = 0;
		let inserted = 0;
		let orphans = 0;

		const select = `
			SELECT i.id_image, i.id_product, i.position, i.cover, il.legend
			  FROM ps_image i
			  LEFT JOIN ps_image_lang il
			         ON il.id_image = i.id_image AND il.id_lang = ${ID_LANG}
			 WHERE 1 = 1 {{WHERE}}`;

		const pageSize = limit === null ? PAGE_SIZE : Math.min(PAGE_SIZE, limit);

		for await (const rows of sourceCursor<SourceImage>(select, 'i.id_image', pageSize)) {
			const batch = rows
				.filter((r) => !alreadyImported.has(Number(r.id_image)))
				.map((r) => {
					const productId = productByLegacy.get(Number(r.id_product));
					if (!productId) {
						orphans++;
						return null;
					}
					return {
						product_id: productId,
						type: 'image' as const,
						url: productImageUrl(Number(r.id_image)),
						alt: text(r.legend),
						position: r.cover ? 0 : Number(r.position) || 0,
						legacy_ps_id: Number(r.id_image)
					};
				})
				.filter((r): r is NonNullable<typeof r> => r !== null);

			// Insertion directe par lots de 1000 (pas de transaction unique)
			if (batch.length > 0) {
				await insertBatched('product_media', batch, { batchSize: 1000 });
				inserted += batch.length;
			}

			read += rows.length;
			bar.tick(read);
			if (limit !== null && read >= limit) break;
		}

		bar.done(inserted);
		if (orphans > 0) {
			log.warn(
				`${count(orphans)} images non rattachées — produit absent en cible, ou déjà importées.`
			);
		}

		return {
			processed: inserted,
			note: orphans > 0 ? `${count(orphans)} non rattachées` : undefined
		};
	}
};

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
import { targetDb } from '../../../lib/target-db.ts';
import { productImageUrl, imageBaseUrl } from '../media-url.ts';
import { text } from '../../../lib/transform.ts';
import { log, count, progress } from '../../../lib/logger.ts';

/** Langue française dans PrestaShop. */
const ID_LANG = 1;

const PAGE_SIZE = 20_000;

interface SourceImage {
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

		const bar = progress('images', expected);
		let read = 0;
		let inserted = 0;

		// Même approche que les liaisons N-N : on déverse les identifiants source
		// dans une table temporaire, et Postgres fait la résolution vers product.id.
		// Charger 1,05 M de couples legacy→id en JS pour 568 712 images serait un
		// gaspillage de mémoire pour un travail que la base fait mieux.
		await sql.begin(async (tx) => {
			await tx`
				CREATE TEMP TABLE tmp_media (
					legacy_image   int  NOT NULL,
					legacy_product int  NOT NULL,
					url            text NOT NULL,
					alt            text,
					position       int  NOT NULL
				) ON COMMIT DROP`;

			const select = `
				SELECT i.id_image, i.id_product, i.position, i.cover, il.legend
				  FROM ps_image i
				  LEFT JOIN ps_image_lang il
				         ON il.id_image = i.id_image AND il.id_lang = ${ID_LANG}
				 WHERE 1 = 1 {{WHERE}}`;

			for await (const rows of sourceCursor<SourceImage>(select, 'i.id_image', PAGE_SIZE)) {
				const batch = rows.map((r) => ({
					legacy_image: Number(r.id_image),
					legacy_product: Number(r.id_product),
					url: productImageUrl(Number(r.id_image)),
					alt: text(r.legend),
					// L'image de couverture passe en position 0 pour être servie en
					// premier : `shop.ts` trie sur (position, id).
					position: r.cover ? 0 : Number(r.position) || 0
				}));

				for (let i = 0; i < batch.length; i += 5000) {
					await tx`INSERT INTO tmp_media ${tx(batch.slice(i, i + 5000))}`;
				}

				read += rows.length;
				bar.tick(read);
				if (limit !== null && read >= limit) break;
			}

			await tx`CREATE INDEX ON tmp_media (legacy_product)`;
			await tx`ANALYZE tmp_media`;

			log.muted('résolution des identifiants côté Postgres…');

			// Idempotence : on écarte les id_image déjà importés. `product_media`
			// n'a pas d'index unique sur legacy_ps_id (le schéma ne l'impose pas),
			// d'où le NOT EXISTS plutôt qu'un ON CONFLICT.
			const result = await tx`
				INSERT INTO product_media (product_id, type, url, alt, position, legacy_ps_id)
				SELECT p.id, 'image', t.url, t.alt, t.position, t.legacy_image
				  FROM tmp_media t
				  JOIN product p ON p.legacy_ps_id = t.legacy_product
				 WHERE NOT EXISTS (
				       SELECT 1 FROM product_media m WHERE m.legacy_ps_id = t.legacy_image
				 )`;

			inserted = result.count;
		});

		bar.done(inserted);

		const orphans = read - inserted;
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

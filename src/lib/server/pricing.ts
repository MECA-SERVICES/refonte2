/**
 * Fragments SQL partagés — prix TTC et vignette produit.
 *
 * Ces expressions étaient recopiées dans chaque domaine (vitrine, panier,
 * catalogue, commandes) ; elles vivent ici pour n'exister qu'une fois.
 * Module de fondations : aucun domaine métier n'est importé.
 */

import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { brand, product, productMedia, taxRule } from '$lib/server/db/schema';

/** Prix TTC = HT × (1 + taux de TVA). Produits sans règle de TVA : HT tel quel. */
export const priceTtcSql = sql<string>`round(${product.priceHt} * (1 + coalesce(${taxRule.rate}, 0) / 100), 2)`;

/** Prix barré TTC, même règle que `priceTtcSql`. */
export const priceTtcStrikeSql = sql<
	string | null
>`round(${product.priceHtStrike} * (1 + coalesce(${taxRule.rate}, 0) / 100), 2)`;

/**
 * Première image d'un produit (position la plus basse). Sous-requête corrélée
 * plutôt qu'une jointure, qui dupliquerait les produits à plusieurs médias.
 *
 * La colonne portant l'identifiant produit varie selon la table interrogée
 * (`product.id`, `order_line.product_id`…) — d'où le paramètre.
 */
export function firstImageSql(productId: PgColumn | SQL): SQL<string | null> {
	return sql<string | null>`(
		SELECT m.url FROM ${productMedia} m
		WHERE m.product_id = ${productId} AND m.type = 'image'
		ORDER BY m.position, m.id
		LIMIT 1
	)`;
}

/**
 * Vignette : première image du produit, à défaut le logo de sa marque.
 *
 * 68 % du catalogue n'a aucune photo — héritage de la reprise. Afficher le logo
 * du fabricant vaut mieux qu'un cadre vide : le client reconnaît au moins
 * l'origine de la pièce. La distinction reste faite côté affichage, pour ne pas
 * présenter un logo comme une photo du produit (cf. `isBrandLogoSql`).
 *
 * Suppose une jointure sur `brand`.
 */
export const thumbnailWithBrandFallbackSql = sql<string | null>`COALESCE(
	${firstImageSql(product.id)},
	${brand.logoUrl}
)`;

/** Vrai lorsque la vignette est un logo de marque et non une photo du produit. */
export const isBrandLogoSql = sql<boolean>`NOT EXISTS (
	SELECT 1 FROM ${productMedia} m
	WHERE m.product_id = ${product.id} AND m.type = 'image'
)`;

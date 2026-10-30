import { error } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { product, taxRule } from '$lib/server/db/catalog.schema';
import { requireStaff } from '$lib/server/guard';
import { priceTtcSql } from '$lib/server/pricing';
import { renderProductLabels } from '$lib/server/product-label-pdf';
import { productsOnSaleFloor } from '$lib/server/stock-locations';

/** Au-delà, une planche ne sert plus à étiqueter un rayon mais à saturer l'imprimante. */
const MAX_LABELS = 500;

/**
 * Étiquettes produit en PDF (reprise de la « Génération étiquette » Dolibarr).
 *
 *     /admin/products/labels?ids=12,12,40
 *
 * Un identifiant répété donne autant d'exemplaires. Le prix TTC n'est imprimé
 * que pour un produit rangé au magasin (`productsOnSaleFloor`). La garde est explicite :
 * `+layout.server.ts` ne s'applique pas aux routes serveur.
 */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);

	const ids = (event.url.searchParams.get('ids') ?? '')
		.split(',')
		.map(Number)
		.filter((id) => Number.isInteger(id) && id > 0)
		.slice(0, MAX_LABELS);
	if (!ids.length) error(400, 'Aucun produit à étiqueter.');

	const rows = await db
		.select({
			id: product.id,
			name: product.name,
			reference: product.reference,
			ean13: product.ean13,
			priceTtc: priceTtcSql
		})
		.from(product)
		.leftJoin(taxRule, eq(taxRule.id, product.taxRuleId))
		.where(inArray(product.id, [...new Set(ids)]));
	const onSale = await productsOnSaleFloor(rows.map((r) => r.id));
	const byId = new Map(
		rows.map((r) => [r.id, { ...r, priceTtc: Number(r.priceTtc), withPrice: onSale.has(r.id) }])
	);
	const products = ids.flatMap((id) => byId.get(id) ?? []);
	if (!products.length) error(404, 'Produit introuvable.');

	const pdf = await renderProductLabels(products);
	return new Response(new Uint8Array(pdf), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'inline; filename="etiquettes.pdf"',
			'Cache-Control': 'private, no-store'
		}
	});
};

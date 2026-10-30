import type { RequestHandler } from './$types';
import { requireStaff } from '$lib/server/guard';
import { exportMissingPrice, isMissingPriceScope } from '$lib/server/purchase-price-report';

/** Cellule CSV : guillemets doublés, séparateur point-virgule (Excel français). */
const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/**
 * Export CSV du rapport des produits sans prix d'achat (demande client 2.3),
 * à compléter puis à réimporter, ou à envoyer aux fournisseurs.
 *
 * La garde est explicite : `+layout.server.ts` ne s'applique pas aux routes
 * serveur, cet endpoint serait sinon ouvert à tous.
 */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);

	const param = event.url.searchParams.get('perimetre');
	const scope = isMissingPriceScope(param) ? param : 'stock';
	const rows = await exportMissingPrice(scope);

	const lines = [
		[
			'ID',
			'Référence',
			'Réf. fournisseur',
			'Désignation',
			'Marque',
			'Type',
			'Stock',
			'Prix de vente HT',
			"Prix d'achat HT"
		]
			.map(cell)
			.join(';'),
		...rows.map((r) =>
			[
				r.id,
				r.reference,
				r.supplierReference,
				r.name,
				r.brand,
				r.type,
				r.stock,
				Number(r.priceHt).toFixed(2).replace('.', ','),
				''
			]
				.map(cell)
				.join(';')
		)
	];

	// BOM : Excel lit alors correctement les accents.
	return new Response('﻿' + lines.join('\r\n'), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="produits-sans-prix-achat-${scope}.csv"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

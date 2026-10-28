/**
 * Rapprochement des produits Dolibarr (`llx_product`) avec les produits de
 * MSShop : un seul catalogue, les données Dolibarr se rattachent à `product`.
 *
 * Ordre de confiance : référence exacte, puis EAN, puis référence sans
 * séparateurs (« 587 42 07-01 » = « 5874207-01 »). Une correspondance
 * ambiguë (plusieurs produits MSShop) n'est pas retenue : mieux vaut un
 * produit non rattaché qu'un stock posé sur la mauvaise fiche.
 */

export interface DoliProduct {
	rowid: number;
	ref: string;
	barcode: string | null;
}

export interface ShopProduct {
	id: number;
	reference: string;
	ean13: string | null;
	isActive: boolean;
}

export type MatchKind = 'reference' | 'ean' | 'compact';

/** Référence sans espaces, tirets, points ni barres, en majuscules. */
export function compactReference(reference: string | null): string {
	return (reference ?? '').replace(/[\s.\-/_]/g, '').toUpperCase();
}

/** EAN exploitable : 8 à 13 chiffres. */
function cleanEan(barcode: string | null): string | null {
	const ean = (barcode ?? '').trim();
	return /^\d{8,13}$/.test(ean) ? ean : null;
}

/**
 * Index des produits MSShop par clé. À clé égale, les produits actifs
 * passent devant : un doublon désactivé ne rend pas la correspondance ambiguë.
 */
function indexBy(products: ShopProduct[], key: (p: ShopProduct) => string | null) {
	const index = new Map<string, ShopProduct[]>();
	for (const p of products) {
		const k = key(p);
		if (k) index.set(k, [...(index.get(k) ?? []), p]);
	}
	return (k: string | null): ShopProduct | undefined => {
		const found = k ? (index.get(k) ?? []) : [];
		const active = found.filter((p) => p.isActive);
		const pool = active.length ? active : found;
		return pool.length === 1 ? pool[0] : undefined;
	};
}

/**
 * Produit MSShop de chaque produit Dolibarr (`rowid` → correspondance). Un
 * produit MSShop n'est attribué qu'une fois, au premier rapprochement par
 * ordre de confiance.
 */
export function matchProducts(
	doli: DoliProduct[],
	shop: ShopProduct[]
): Map<number, { productId: number; kind: MatchKind }> {
	const byReference = indexBy(shop, (p) => p.reference.trim());
	const byEan = indexBy(shop, (p) => cleanEan(p.ean13));
	const byCompact = indexBy(shop, (p) => compactReference(p.reference) || null);
	const lookups: [MatchKind, (d: DoliProduct) => ShopProduct | undefined][] = [
		['reference', (d) => byReference(d.ref.trim())],
		['ean', (d) => byEan(cleanEan(d.barcode))],
		['compact', (d) => byCompact(compactReference(d.ref) || null)]
	];

	const matches = new Map<number, { productId: number; kind: MatchKind }>();
	const taken = new Set<number>();
	for (const [kind, lookup] of lookups) {
		for (const d of doli) {
			if (matches.has(d.rowid)) continue;
			const product = lookup(d);
			if (!product || taken.has(product.id)) continue;
			matches.set(d.rowid, { productId: product.id, kind });
			taken.add(product.id);
		}
	}
	return matches;
}

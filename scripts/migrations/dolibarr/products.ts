/**
 * Rapprochement des produits Dolibarr (`llx_product`) avec les produits de
 * MSShop : un seul catalogue, les données Dolibarr se rattachent à `product`.
 *
 * Ordre de confiance : référence exacte, puis EAN, puis référence sans
 * séparateurs (« 587 42 07-01 » = « 5874207-01 »), puis numéro de pièce sans
 * préfixe de marque (« HON-72613VA4000 » = « HOND-72613VA4000 », « ALK-AK474669 »
 * = « ALK-474669 ») à condition que les noms concordent. Une correspondance
 * ambiguë (plusieurs produits MSShop) n'est pas retenue : mieux vaut un
 * produit non rattaché qu'un stock posé sur la mauvaise fiche.
 */

export interface DoliProduct {
	rowid: number;
	ref: string;
	barcode: string | null;
	label?: string | null;
}

export interface ShopProduct {
	id: number;
	reference: string;
	ean13: string | null;
	isActive: boolean;
	name?: string;
	supplierReference?: string | null;
}

export type MatchKind = 'reference' | 'ean' | 'compact' | 'part-number';

/** Ressemblance minimale des noms pour un rapprochement par numéro de pièce. */
const MIN_NAME_SIMILARITY = 0.25;

/** Référence sans espaces, tirets, points ni barres, en majuscules. */
export function compactReference(reference: string | null): string {
	return (reference ?? '').replace(/[\s.\-/_]/g, '').toUpperCase();
}

/**
 * Numéros de pièce d'une référence : sans préfixe de marque (« HON- ») ni
 * séparateurs, et sans lettres de tête si le reste est un numéro d'au moins
 * 5 chiffres (« AK474669 » → « 474669 », habitude de saisie AL-KO).
 */
export function partNumbers(reference: string | null): string[] {
	const core = compactReference((reference ?? '').replace(/^[A-Za-z]+-/, ''));
	if (!core) return [];
	const digits = /^[A-Z]{1,3}(\d{5,})$/.exec(core)?.[1];
	return digits ? [core, digits] : [core];
}

/** Mots d'un nom, sans accents ni la marque qui suit « | ». */
function nameWords(name: string): Set<string> {
	const words = name
		.split('|')[0]
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((w) => w.length >= 3);
	return new Set(words);
}

/** Part de mots communs entre deux noms (indice de Jaccard), de 0 à 1. */
export function nameSimilarity(a: string, b: string): number {
	const [x, y] = [nameWords(a), nameWords(b)];
	if (!x.size || !y.size) return 0;
	const common = [...x].filter((w) => y.has(w)).length;
	return common / (x.size + y.size - common);
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
	// Numéro de pièce : depuis la référence et la référence fournisseur de MSShop.
	const byPart = new Map<string, ShopProduct[]>();
	for (const p of shop) {
		const keys = new Set([
			...partNumbers(p.reference),
			...(p.supplierReference ? [compactReference(p.supplierReference)] : [])
		]);
		for (const k of keys) if (k) byPart.set(k, [...(byPart.get(k) ?? []), p]);
	}
	const byPartNumber = (d: DoliProduct) => {
		const found = new Map<number, ShopProduct>();
		for (const k of partNumbers(d.ref)) for (const p of byPart.get(k) ?? []) found.set(p.id, p);
		const similar = [...found.values()].filter(
			(p) => nameSimilarity(d.label ?? '', p.name ?? '') >= MIN_NAME_SIMILARITY
		);
		return similar.length === 1 ? similar[0] : undefined;
	};
	const lookups: [MatchKind, (d: DoliProduct) => ShopProduct | undefined][] = [
		['reference', (d) => byReference(d.ref.trim())],
		['ean', (d) => byEan(cleanEan(d.barcode))],
		['compact', (d) => byCompact(compactReference(d.ref) || null)],
		['part-number', byPartNumber]
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

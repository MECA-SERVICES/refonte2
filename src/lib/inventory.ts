/**
 * Inventaire annuel, repris du module Dolibarr « UTILE » : on compte chaque
 * produit par emplacement et par état, puis on compare au stock et on valide.
 * Fonctions pures, partagées par le serveur et ses tests.
 */

/**
 * Portée de la validation :
 * - `all` : tout le stock, comme UTILE — ce qui n'a pas été compté passe à 0 ;
 * - `counted-locations` : seulement les emplacements où l'on a compté.
 */
export const INVENTORY_SCOPES = [
	{ value: 'all', name: 'Tout le stock (comme Dolibarr)' },
	{ value: 'counted-locations', name: 'Seulement les emplacements comptés' }
] as const;

export type InventoryScope = (typeof INVENTORY_SCOPES)[number]['value'];

export function isInventoryScope(value: unknown): value is InventoryScope {
	return INVENTORY_SCOPES.some((s) => s.value === value);
}

/** Une quantité par produit, emplacement et état : comptée ou en stock. */
export type StockLine = {
	productId: number;
	locationId: number;
	condition: string;
	quantity: number;
};

export type InventoryGap = {
	productId: number;
	locationId: number;
	condition: string;
	/** En stock avant validation. */
	current: number;
	counted: number;
	/** Mouvement d'ajustement à passer : compté − stock. */
	delta: number;
};

const keyOf = (l: Omit<StockLine, 'quantity'>) => `${l.productId}:${l.locationId}:${l.condition}`;

/**
 * Écarts entre le comptage et le stock, dans la portée choisie. Une ligne de
 * stock non comptée dans la portée passe à 0 ; une ligne comptée hors stock
 * entre en stock.
 */
export function inventoryGaps(
	counts: StockLine[],
	stock: StockLine[],
	scope: InventoryScope
): InventoryGap[] {
	const countedLocations = new Set(counts.map((c) => c.locationId));
	const inScope = stock.filter((s) => scope === 'all' || countedLocations.has(s.locationId));

	const lines = new Map<string, InventoryGap>();
	for (const s of inScope) {
		lines.set(keyOf(s), { ...s, current: s.quantity, counted: 0, delta: 0 });
	}
	for (const c of counts) {
		const line = lines.get(keyOf(c)) ?? { ...c, current: 0, counted: 0, delta: 0 };
		line.counted += c.quantity;
		lines.set(keyOf(c), line);
	}
	return [...lines.values()]
		.map(({ productId, locationId, condition, current, counted }) => ({
			productId,
			locationId,
			condition,
			current,
			counted,
			delta: counted - current
		}))
		.filter((g) => g.delta !== 0);
}

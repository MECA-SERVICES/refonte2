import { describe, expect, it } from 'vitest';
import { inventoryGaps } from './inventory';

const line = (productId: number, locationId: number, quantity: number, condition = 'new') => ({
	productId,
	locationId,
	condition,
	quantity
});

describe('écarts d’inventaire', () => {
	const stock = [line(1, 10, 5), line(2, 10, 3), line(3, 20, 4), line(1, 10, 1, 'used')];
	const counts = [line(1, 10, 4), line(4, 10, 2), line(1, 10, 1, 'used')];

	it('tout le stock : le non-compté passe à 0, le nouveau entre', () => {
		expect(inventoryGaps(counts, stock, 'all')).toEqual([
			{ productId: 1, locationId: 10, condition: 'new', current: 5, counted: 4, delta: -1 },
			{ productId: 2, locationId: 10, condition: 'new', current: 3, counted: 0, delta: -3 },
			{ productId: 3, locationId: 20, condition: 'new', current: 4, counted: 0, delta: -4 },
			{ productId: 4, locationId: 10, condition: 'new', current: 0, counted: 2, delta: 2 }
		]);
	});

	it('emplacements comptés seulement : le reste du stock ne bouge pas', () => {
		const gaps = inventoryGaps(counts, stock, 'counted-locations');
		expect(gaps.map((g) => [g.productId, g.delta])).toEqual([
			[1, -1],
			[2, -3],
			[4, 2]
		]);
	});

	it('distingue les états : l’occasion compté juste ne crée pas d’écart', () => {
		const gaps = inventoryGaps(counts, stock, 'all');
		expect(gaps.some((g) => g.condition === 'used')).toBe(false);
	});
});

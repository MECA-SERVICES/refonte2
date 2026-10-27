import { describe, it, expect } from 'vitest';
import { isCartLineBlocking } from '$lib/cart';

/**
 * Règle R7 (CDC 18) : un article désactivé, ou réservé à la vente à l'atelier,
 * bloque le passage en commande. Un article en rupture reste commandable : il
 * part « sur commande » (décision du 27/10/2026).
 */
describe('blocage du panier (R7)', () => {
	const ok = { isActive: true, availableForOrder: true, stock: 5 };

	it('laisse passer un article disponible', () => {
		expect(isCartLineBlocking(ok)).toBe(false);
	});

	it('bloque un article désactivé', () => {
		expect(isCartLineBlocking({ ...ok, isActive: false })).toBe(true);
	});

	it('laisse passer un article en rupture, commandé chez le fabricant', () => {
		const outOfStock = { ...ok, stock: 0 };
		expect(isCartLineBlocking(outOfStock)).toBe(false);
	});

	it("bloque un article réservé à la vente à l'atelier", () => {
		// 14 671 produits actifs du catalogue sont dans ce cas.
		expect(isCartLineBlocking({ ...ok, availableForOrder: false })).toBe(true);
	});
});

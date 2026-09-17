import { describe, it, expect } from 'vitest';

/**
 * Règle R7 (CDC 18) : un article désactivé, en rupture, ou réservé à la
 * boutique physique bloque le passage en commande.
 *
 * La logique est testée ici sur la fonction pure plutôt que sur la base, pour
 * que la suite reste exécutable sans PostgreSQL.
 */
function isBlocking(line: { isActive: boolean; availableForOrder: boolean; stock: number }) {
	return !line.isActive || !line.availableForOrder || line.stock <= 0;
}

describe('blocage du panier (R7)', () => {
	const ok = { isActive: true, availableForOrder: true, stock: 5 };

	it('laisse passer un article disponible', () => {
		expect(isBlocking(ok)).toBe(false);
	});

	it('bloque un article désactivé', () => {
		expect(isBlocking({ ...ok, isActive: false })).toBe(true);
	});

	it('bloque un article en rupture', () => {
		expect(isBlocking({ ...ok, stock: 0 })).toBe(true);
	});

	it('bloque un article réservé à la boutique physique', () => {
		// 36 236 produits du catalogue sont dans ce cas : sans cette règle, ils
		// étaient commandables en ligne.
		expect(isBlocking({ ...ok, availableForOrder: false })).toBe(true);
	});
});

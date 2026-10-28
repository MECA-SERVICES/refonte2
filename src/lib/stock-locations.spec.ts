import { describe, expect, it } from 'vitest';
import {
	deletionBlockerOf,
	flattenLocations,
	locationScore,
	subtreeIds,
	subtreeQuantities
} from './stock-locations';

const node = (id: number, name: string, parentId: number | null, position = 0) => ({
	id,
	name,
	parentId,
	position
});

describe('flattenLocations', () => {
	it('place chaque enfant sous son parent, avec son chemin complet', () => {
		const flat = flattenLocations([
			node(8, 'ETAGERE 41', 4, 41),
			node(1, 'MAGASIN', null, 1),
			node(4, 'PARTIE DROITE', 1, 4),
			node(9, 'ETAGERE 42', 4, 42)
		]);
		expect(flat.map((l) => [l.name, l.depth])).toEqual([
			['MAGASIN', 0],
			['PARTIE DROITE', 1],
			['ETAGERE 41', 2],
			['ETAGERE 42', 2]
		]);
		expect(flat[2].path).toBe('MAGASIN › PARTIE DROITE › ETAGERE 41');
	});

	it('garde un emplacement dont le parent est introuvable, comme une racine', () => {
		const flat = flattenLocations([node(5, 'Orphelin', 999)]);
		expect(flat).toHaveLength(1);
		expect(flat[0].depth).toBe(0);
	});
});

describe('recherche des emplacements', () => {
	const flat = flattenLocations([
		{ ...node(4, 'MAGASIN PIECES DETACHEES / PARTIE DROITE', null, 4), quantity: 0 },
		{ ...node(43, 'ETAGERE 43', 4, 43), quantity: 2 },
		{ ...node(437, 'RANGEE 7', 43, 437), quantity: 3 },
		{ ...node(4372, 'BOITE 2', 437, 4372), quantity: 5 }
	]);

	it('cumule les quantités des sous-emplacements', () => {
		expect(subtreeIds(flat, 43)).toEqual([43, 437, 4372]);
		expect(subtreeQuantities(flat).get(4)).toBe(10);
		expect(subtreeQuantities(flat).get(437)).toBe(8);
	});

	it('classe le code exact, puis le début de code, puis le chemin', () => {
		const boite = { path: flat[3].path, code: '4372' };
		expect(locationScore('4372', boite)).toBe(0);
		expect(locationScore('437', boite)).toBe(1);
		expect(locationScore('droite étagère 43 r7 b2', boite)).toBe(2);
		expect(locationScore('gauche', boite)).toBeNull();
		expect(locationScore('r8', boite)).toBeNull();
	});
});

describe('suppression des emplacements', () => {
	const empty = { children: 0, units: 0, movements: 0, legacyDoliId: null };
	it('autorise un emplacement vide, sans historique, créé dans MSShop', () => {
		expect(deletionBlockerOf(empty)).toBeNull();
	});
	it('explique ce qui bloque, du plus évident au moins évident', () => {
		expect(deletionBlockerOf({ ...empty, children: 2, units: 5 })).toMatch(/2 sous-emplacements/);
		expect(deletionBlockerOf({ ...empty, units: 1 })).toMatch(/1 unité :/);
		expect(deletionBlockerOf({ ...empty, movements: 3 })).toMatch(/historique/);
		expect(deletionBlockerOf({ ...empty, legacyDoliId: 12 })).toMatch(/Dolibarr/);
	});
});

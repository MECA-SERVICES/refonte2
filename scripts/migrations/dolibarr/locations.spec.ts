import { describe, expect, it } from 'vitest';
import {
	locationDescription,
	locationName,
	locationSegments,
	resolveParents
} from './locations.ts';

const loc = (rowid: number, ref: string, lieu: string, fk_parent: number | null = null) => ({
	rowid,
	ref,
	lieu,
	fk_parent
});

describe('emplacements Dolibarr', () => {
	it('nettoie les segments du chemin', () => {
		expect(locationSegments('MAGASIN PIECES DETACHEES /. PARTIE GAUCHE ')).toEqual([
			'MAGASIN PIECES DETACHEES',
			'PARTIE GAUCHE'
		]);
		const gauche = loc(7, '7', 'MAGASIN PIECES DETACHEES /. PARTIE GAUCHE');
		expect(locationName(gauche, true)).toBe('PARTIE GAUCHE');
		// Sans parent, le chemin complet garde le contexte.
		expect(locationName(gauche, false)).toBe('MAGASIN PIECES DETACHEES / PARTIE GAUCHE');
		expect(locationDescription(gauche)).toBe('MAGASIN PIECES DETACHEES / PARTIE GAUCHE');
		expect(locationDescription(loc(8, '8', ' '))).toBeNull();
	});

	it('retrouve le parent par le chemin, même quand fk_parent contient une référence', () => {
		const parents = resolveParents([
			loc(4, '4', 'MAGASIN / PARTIE DROITE'),
			loc(11, '44', 'MAGASIN / PARTIE DROITE / ETAGERE 44', 4),
			// Saisie UTILE : fk_parent = 44, la référence de l'étagère, pas son rowid (11).
			loc(50, '441', 'MAGASIN / PARTIE DROITE / ETAGERE 44 / RANGEE 1', 44)
		]);
		expect(parents.get(11)).toBe(4);
		expect(parents.get(50)).toBe(11);
	});

	it("ignore un fk_parent qui ne correspond pas au chemin, et garde l'emplacement en racine", () => {
		const parents = resolveParents([loc(1, '1', 'MAGASIN'), loc(2, '2', 'ATELIER', 1)]);
		expect(parents.has(2)).toBe(false);
	});
});

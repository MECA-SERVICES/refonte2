import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
	it('met en minuscules et remplace les espaces par des tirets', () => {
		expect(slugify('Filtre à huile')).toBe('filtre-a-huile');
	});

	it('retire les accents', () => {
		expect(slugify('Échappement Ø45 émaillé')).toBe('echappement-45-emaille');
	});

	it('supprime les tirets en début et fin', () => {
		expect(slugify('  --Kit chaîne-- ')).toBe('kit-chaine');
	});

	it('compacte les caractères spéciaux consécutifs en un seul tiret', () => {
		expect(slugify('Plaquettes (avant / arrière)')).toBe('plaquettes-avant-arriere');
	});

	it('conserve les chiffres (références produit)', () => {
		expect(slugify('YZF-R125 2019')).toBe('yzf-r125-2019');
	});
});

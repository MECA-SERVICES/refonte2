import { describe, expect, it } from 'vitest';
import { brandLabel, headPhrases, popularity, sameSuggestion, suggestionKey } from './suggestions';

describe('headPhrases', () => {
	it('retient les expressions de tête, jusqu’à trois mots de contenu', () => {
		expect(headPhrases('Filtre à huile moteur 4T | KUBOTA')).toEqual([
			'filtre',
			'filtre à huile',
			'filtre à huile moteur'
		]);
	});

	it('s’arrête à la première cote ou référence', () => {
		expect(headPhrases('COURROIE 13X560 | ETESIA')).toEqual(['courroie']);
		expect(headPhrases('Savon Dreumex Classic rouge 4.5L | DREUMEX')).toEqual([
			'savon',
			'savon dreumex',
			'savon dreumex classic'
		]);
	});

	it('ne finit jamais une expression sur un mot vide', () => {
		expect(headPhrases('Nettoyant pour mains SF7850')).toEqual([
			'nettoyant',
			'nettoyant pour mains'
		]);
	});

	it('garde tirets et apostrophes à l’intérieur des mots', () => {
		expect(headPhrases('Taille-haie d’élagage 18V')).toEqual([
			'taille-haie',
			"taille-haie d'élagage"
		]);
	});

	it('ne coupe pas une expression sur « sans »', () => {
		expect(headPhrases('Meuleuse sans fil 18V')).toEqual(['meuleuse', 'meuleuse sans fil']);
	});

	it('écarte les désignations en langue étrangère et les mots trop courts', () => {
		expect(headPhrases('Timing belts endless 8M')).toEqual([]);
		expect(headPhrases('Wheel assy, turf save')).toEqual([]);
		expect(headPhrases('KS 50 kit')).toEqual([]);
	});
});

describe('suggestionKey', () => {
	it('compare sans accent, sans casse ni mot vide', () => {
		expect(suggestionKey('Filtre à huile')).toBe('filtre huile');
		expect(suggestionKey("filtre d'huile")).toBe('filtre huile');
		expect(suggestionKey('taille-haie')).toBe('taille haie');
	});
});

describe('popularity', () => {
	it('fait passer les ventes avant l’abondance du catalogue', () => {
		// 30 savons vendus régulièrement contre 3 000 vis jamais commandées.
		expect(popularity(30, 200)).toBeGreaterThan(popularity(3000, 0));
	});

	it('croît avec le nombre de produits à ventes égales', () => {
		expect(popularity(50, 0)).toBeGreaterThan(popularity(5, 0));
	});
});

describe('brandLabel', () => {
	it('nettoie les libellés de marque', () => {
		expect(brandLabel('EGO POWER +')).toBe('ego power');
		expect(brandLabel('HITACHI - HIKOKI')).toBe('hitachi hikoki');
		expect(brandLabel('B&S')).toBe('b&s');
	});

	it('écarte les marques génériques', () => {
		expect(brandLabel('NON ORIGINAL')).toBeNull();
		expect(brandLabel('Autre marque')).toBeNull();
		expect(brandLabel(null)).toBeNull();
	});
});

describe('sameSuggestion', () => {
	it('ignore accents, mots vides et pluriels', () => {
		expect(sameSuggestion('Robots de tonte', 'robot tonte')).toBe(true);
		expect(sameSuggestion('Filtres à huile', 'filtre a huile')).toBe(true);
	});

	it('distingue des libellés différents', () => {
		expect(sameSuggestion('savon dreumex', 'savon')).toBe(false);
	});
});

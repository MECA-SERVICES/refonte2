import { describe, expect, it } from 'vitest';
import { textColorOn } from './admin-colors';

describe('textColorOn', () => {
	it('met le texte en blanc sur une couleur foncée', () => {
		expect(textColorOn('#4169E1')).toBe('white');
		expect(textColorOn('#6c868e')).toBe('white');
	});

	it('met le texte en gris foncé sur une couleur claire', () => {
		expect(textColorOn('#FF69B4')).toBe('#383838');
		expect(textColorOn('#ff7941')).toBe('#383838');
		expect(textColorOn('#fff')).toBe('#383838');
	});

	it('traite une couleur illisible comme foncée', () => {
		expect(textColorOn('pas une couleur')).toBe('white');
	});
});

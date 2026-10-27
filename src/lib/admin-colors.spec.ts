import { describe, expect, it } from 'vitest';
import { textColorOn } from './admin-colors';

/** Ratio de contraste WCAG entre deux couleurs hexadécimales. */
function contrast(a: string, b: string): number {
	const lum = (hex: string) => {
		const [r, g, b] = [1, 3, 5].map((i) => {
			const c = parseInt(hex.slice(i, i + 2), 16) / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe('textColorOn', () => {
	it('met le texte en blanc sur une couleur foncée', () => {
		expect(textColorOn('#4169E1')).toBe('white');
		expect(textColorOn('#363a41')).toBe('white');
	});

	it('met le texte en noir sur une couleur claire', () => {
		expect(textColorOn('#FF69B4')).toBe('black');
		expect(textColorOn('#ff7941')).toBe('black');
		expect(textColorOn('#fff')).toBe('black');
	});

	it('atteint 4,5:1 sur toutes les couleurs d’état reprises de PrestaShop', () => {
		const states = [
			'#4169E1',
			'#32CD32',
			'#FF8C00',
			'#8A2BE2',
			'#108510',
			'#DC143C',
			'#ec2e15',
			'#8f0621',
			'#FF69B4',
			'#cc6f00',
			'#a1f8a1',
			'#ffc3b2',
			'#f5ff39',
			'#ffe115',
			'#c40069',
			'#f700d1',
			'#ff7941',
			'#3a0088',
			'#700dff',
			'#009c25',
			'#B8BEE0',
			'#EBEBBF',
			'#E09D9D',
			'#5b841b',
			'#ff0000',
			'#f839ff',
			'#70b580',
			'#c05c67',
			'#cd9321',
			'#6c868e',
			'#25b9d7'
		];
		for (const color of states) {
			const text = textColorOn(color) === 'black' ? '#000000' : '#ffffff';
			expect(contrast(text, color), color).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('traite une couleur illisible comme foncée', () => {
		expect(textColorOn('pas une couleur')).toBe('white');
	});
});

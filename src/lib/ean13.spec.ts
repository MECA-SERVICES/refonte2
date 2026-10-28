import { describe, expect, it } from 'vitest';
import { ean13Bars, ean13CheckDigit, ean13Modules, isValidEan13, printableEan13 } from './ean13';

describe('EAN-13', () => {
	it('calcule le chiffre de contrôle', () => {
		expect(ean13CheckDigit('400638133393')).toBe(1);
		expect(ean13CheckDigit('978020137962')).toBe(4);
	});

	it('corrige un chiffre de contrôle faux, comme UTILE, et ignore un code incomplet', () => {
		expect(printableEan13('4006381333930')).toBe('4006381333931');
		expect(isValidEan13('4006381333931')).toBe(true);
		expect(isValidEan13('4006381333930')).toBe(false);
		expect(printableEan13('123')).toBeNull();
		expect(printableEan13(null)).toBeNull();
	});

	it('produit les 95 modules et des gardes plus longues', () => {
		const modules = ean13Modules('4006381333931');
		expect(modules).toHaveLength(95);
		expect(modules.startsWith('101')).toBe(true);
		expect(modules.slice(45, 50)).toBe('01010');
		const bars = ean13Bars('4006381333931');
		expect(bars.filter((b) => b.guard)).toHaveLength(6);
		expect(bars.reduce((sum, b) => sum + b.width, 0)).toBe(
			[...modules].filter((m) => m === '1').length
		);
	});
});

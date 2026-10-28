import { describe, expect, it } from 'vitest';
import { labelTexts } from './product-labels';

const product = {
	name: 'COURROIE BV F72H 2001 A 2005 | CASTEL GARDEN',
	reference: 'CAS-135061403',
	ean13: null,
	priceTtc: 24.5,
	withPrice: false
};

describe('étiquettes produit', () => {
	it('écrit la désignation en minuscules et la référence, sans prix', () => {
		expect(labelTexts(product)).toEqual({
			lines: ['courroie bv f72h 2001 a 2005 | castel garden'],
			reference: 'Référence : CAS-135061403',
			price: null
		});
	});

	it('imprime le prix TTC pour un produit rangé au magasin', () => {
		expect(labelTexts({ ...product, withPrice: true }).price).toBe('24,50 € TTC');
	});

	it('coupe une longue désignation en deux lignes de 48 caractères', () => {
		const long = labelTexts({ ...product, name: 'A'.repeat(60) });
		expect(long.lines).toEqual(['a'.repeat(48), `${'a'.repeat(12)}.`]);
	});
});

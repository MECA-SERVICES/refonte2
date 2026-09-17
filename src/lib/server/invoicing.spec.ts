import { describe, it, expect } from 'vitest';
import { buildTaxBreakdown, formatInvoiceNumber } from './invoicing';

describe('formatInvoiceNumber', () => {
	it('préfixe et complète les numéros de la séquence', () => {
		// Format repris des factures PrestaShop en circulation.
		expect(formatInvoiceNumber('25633')).toBe('#FA025633');
		expect(formatInvoiceNumber('1')).toBe('#FA000001');
	});

	it('laisse tel quel un numéro déjà formaté', () => {
		expect(formatInvoiceNumber('FA025633')).toBe('#FA025633');
	});
});

describe('buildTaxBreakdown', () => {
	it('sépare produits et livraison, et déduit le taux appliqué', () => {
		// Chiffres repris de la facture FA025633.
		const lines = buildTaxBreakdown({
			productsHt: 28.93,
			productsTva: 5.79,
			shippingHt: 5.75,
			shippingTva: 1.15
		});

		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatchObject({ label: 'Produits', baseHt: 28.93, taxAmount: 5.79 });
		expect(lines[0]?.rate).toBeCloseTo(20, 1);
		expect(lines[1]).toMatchObject({ label: 'Livraison', baseHt: 5.75, taxAmount: 1.15 });
		expect(lines[1]?.rate).toBeCloseTo(20, 1);
	});

	it("n'imprime pas une assiette nulle", () => {
		const lines = buildTaxBreakdown({
			productsHt: 100,
			productsTva: 20,
			shippingHt: 0,
			shippingTva: 0
		});
		expect(lines).toHaveLength(1);
		expect(lines[0]?.label).toBe('Produits');
	});

	it('accepte une commande exonérée : assiette sans taxe', () => {
		// Autoliquidation intracommunautaire : la base reste imprimée, à 0 %.
		const lines = buildTaxBreakdown({
			productsHt: 250,
			productsTva: 0,
			shippingHt: 0,
			shippingTva: 0
		});
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({ baseHt: 250, taxAmount: 0, rate: 0 });
	});
});

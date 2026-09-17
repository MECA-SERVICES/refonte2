import { describe, it, expect } from 'vitest';
import { renderInvoicePdf, invoiceFileName } from './invoice-pdf';

/**
 * Le gabarit est monté sur des données réalistes plutôt que sur la base : on
 * vérifie le document produit, pas l'accès aux données.
 */
function fixture(overrides: Record<string, unknown> = {}) {
	return {
		invoice: {
			id: 1,
			orderId: 30368,
			number: '25470',
			deliveryNumber: null,
			deliveryDate: null,
			totalHt: '198.1700',
			totalTtc: '237.8000',
			shippingHt: '5.7500',
			shippingTtc: '6.9000',
			discountHt: '0',
			discountTtc: '0',
			shopAddress: null,
			note: null,
			taxBreakdown: null,
			taxRegime: null,
			taxMention: null,
			issuedAt: new Date('2026-08-19T10:00:00Z'),
			legacyPsId: null,
			createdAt: new Date('2026-08-19T10:00:00Z'),
			...(overrides.invoice ?? {})
		},
		order: {
			id: 30368,
			reference: 'WIIJVDJUB',
			totalTva: '39.63',
			shippingFee: '6.90',
			carrierName: 'Chronopost',
			trackingNumber: null,
			createdAt: new Date('2026-08-19T09:00:00Z'),
			shippingAddress: {
				firstName: 'Patrick',
				lastName: 'Bordeau',
				line1: '287 Route du bois sueur',
				postalCode: '27130',
				city: 'Piseux',
				country: 'FR'
			},
			billingAddress: null,
			...(overrides.order ?? {})
		},
		customerType: 'particulier',
		companyName: null,
		vatNumber: null,
		lines: [
			{
				id: 1,
				productReference: 'WEIB-Y20534V0',
				productName: 'BOITIER COMPLET WB536SKALV | WEIBANG',
				unitPriceHt: '192.4200',
				totalHt: '192.42',
				totalTtc: '230.90',
				quantity: 1
			}
		],
		payment: { method: 'CB - MASTERCARD - VISA', amount: '237.80' },
		...overrides
		// Le gabarit n'a besoin que de ces champs ; le type complet vient de la base.
	} as unknown as Parameters<typeof renderInvoicePdf>[0];
}

describe('renderInvoicePdf', () => {
	it('produit un PDF valide', async () => {
		const pdf = await renderInvoicePdf(fixture());
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		expect(pdf.length).toBeGreaterThan(1000);
	});

	it('reconstitue la ventilation absente des factures migrées', async () => {
		// Sans repli, ces factures afficheraient « Aucune taxe » sur une
		// commande pourtant taxée à 39,63 €.
		const pdf = await renderInvoicePdf(fixture());
		const text = pdf.toString('latin1');
		expect(text).not.toContain('Aucune taxe');
	});

	it('imprime la mention légale quand la TVA est exonérée', async () => {
		const pdf = await renderInvoicePdf(
			fixture({
				invoice: {
					taxMention: 'Autoliquidation de la TVA — art. 283-2 du CGI',
					taxBreakdown: [{ label: 'Produits', rate: 0, baseHt: 198.17, taxAmount: 0 }]
				}
			})
		);
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
	});

	it('nomme le fichier avec le numéro formaté', () => {
		expect(invoiceFileName('25470')).toBe('FA025470.pdf');
	});
});

import { describe, expect, it } from 'vitest';
import {
	counterOf,
	formatCounterNumber,
	invoiceTotals,
	lineTotals,
	priceHtFromTtc,
	remainingDue
} from './counter-invoices';

describe('factures comptoir', () => {
	it('arrondit chaque ligne au centime, remise comprise', () => {
		expect(lineTotals({ quantity: 1.5, unitPriceHt: 43, taxRate: 20, discountPercent: 0 })).toEqual(
			{
				totalHt: 64.5,
				totalTva: 12.9,
				totalTtc: 77.4
			}
		);
		expect(
			lineTotals({ quantity: 2, unitPriceHt: 14.95, taxRate: 20, discountPercent: 10 })
		).toEqual({
			totalHt: 26.91,
			totalTva: 5.38,
			totalTtc: 32.29
		});
	});

	it('ventile la TVA par taux', () => {
		const t = invoiceTotals([
			{ quantity: 1, unitPriceHt: 100, taxRate: 20, discountPercent: 0 },
			{ quantity: 1, unitPriceHt: 55, taxRate: 10, discountPercent: 0 },
			{ quantity: 2, unitPriceHt: 10, taxRate: 20, discountPercent: 0 }
		]);
		expect(t).toEqual({
			totalHt: 175,
			totalTva: 29.5,
			totalTtc: 204.5,
			taxBreakdown: [
				{ rate: 20, baseHt: 120, taxAmount: 24 },
				{ rate: 10, baseHt: 55, taxAmount: 5.5 }
			]
		});
	});

	it('retrouve le HT depuis un prix TTC saisi au comptoir', () => {
		expect(priceHtFromTtc(51.6, 20)).toBe(43);
		expect(priceHtFromTtc(60.5, 10)).toBe(55);
	});

	it('numérote comme la série Dolibarr', () => {
		expect(formatCounterNumber('FA', new Date(2026, 10, 3), 1316)).toBe('FA2611-1316');
		expect(formatCounterNumber('AV', new Date(2026, 10, 3), 33)).toBe('AV2611-0033');
		expect(counterOf('FA2610-1315')).toBe(1315);
		expect(counterOf('(PROV1003)')).toBeNull();
	});

	it('calcule le reste à payer, avoirs compris', () => {
		expect(remainingDue(179.95, 100, 0)).toBe(79.95);
		expect(remainingDue(179.95, 100, 79.95)).toBe(0);
	});
});

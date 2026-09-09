import { describe, expect, it } from 'vitest';
import {
	computeTax,
	effectiveTaxRate,
	priceDisplayMode,
	resolveTaxRegime,
	TAX_MENTIONS
} from './tax';

describe('resolveTaxRegime', () => {
	it('applique la TVA française au particulier français (R3)', () => {
		expect(resolveTaxRegime({ country: 'FR', type: 'particulier' })).toBe('standard');
	});

	it('traite un pays non renseigné comme la France (R5)', () => {
		expect(resolveTaxRegime({ type: 'particulier' })).toBe('standard');
		expect(resolveTaxRegime(null)).toBe('standard');
	});

	it('exonère le client hors Union européenne (R1)', () => {
		expect(resolveTaxRegime({ country: 'CH', type: 'particulier' })).toBe('export_outside_eu');
		expect(resolveTaxRegime({ country: 'US', type: 'pro' })).toBe('export_outside_eu');
	});

	it('autorise l’autoliquidation aux trois conditions réunies (R2)', () => {
		expect(
			resolveTaxRegime({ country: 'DE', type: 'pro', taxExemptStatus: 'exempt_eu_b2b' })
		).toBe('reverse_charge_eu');
		expect(
			resolveTaxRegime({ country: 'BE', type: 'collectivite', taxExemptStatus: 'exempt_eu_b2b' })
		).toBe('reverse_charge_eu');
	});

	it('refuse l’autoliquidation dès qu’une condition manque (R6)', () => {
		// Particulier européen : assujetti à la TVA française.
		expect(
			resolveTaxRegime({ country: 'DE', type: 'particulier', taxExemptStatus: 'exempt_eu_b2b' })
		).toBe('standard');
		// Professionnel européen sans statut prononcé par un administrateur.
		expect(resolveTaxRegime({ country: 'DE', type: 'pro' })).toBe('standard');
		// Professionnel français : jamais d'autoliquidation.
		expect(
			resolveTaxRegime({ country: 'FR', type: 'pro', taxExemptStatus: 'exempt_eu_b2b' })
		).toBe('standard');
	});

	it('maintient au régime standard un compte professionnel en attente (R11)', () => {
		expect(
			resolveTaxRegime({
				country: 'IT',
				type: 'pro',
				taxExemptStatus: 'exempt_eu_b2b',
				status: 'pending'
			})
		).toBe('standard');
	});
});

describe('effectiveTaxRate', () => {
	it('reprend le taux du produit au régime standard (R10)', () => {
		expect(effectiveTaxRate('20.000', 'standard')).toBe(20);
		expect(effectiveTaxRate(5.5, 'standard')).toBe(5.5);
	});

	it('annule le taux sous un régime exonéré', () => {
		expect(effectiveTaxRate('20.000', 'export_outside_eu')).toBe(0);
		expect(effectiveTaxRate('20.000', 'reverse_charge_eu')).toBe(0);
	});

	it('traite un produit sans règle de TVA comme exonéré', () => {
		expect(effectiveTaxRate(null, 'standard')).toBe(0);
	});
});

describe('computeTax', () => {
	it('ventile un montant au taux normal', () => {
		expect(computeTax(100, 20)).toEqual({ totalHt: 100, totalTva: 20, totalTtc: 120 });
	});

	it('arrondit au centime', () => {
		expect(computeTax(41.5, 20)).toEqual({ totalHt: 41.5, totalTva: 8.3, totalTtc: 49.8 });
		expect(computeTax(19.99, 5.5)).toEqual({ totalHt: 19.99, totalTva: 1.1, totalTtc: 21.09 });
	});

	it('produit une TVA nulle sous exonération (R18)', () => {
		expect(computeTax(250, 0)).toEqual({ totalHt: 250, totalTva: 0, totalTtc: 250 });
	});
});

describe('priceDisplayMode', () => {
	it('affiche le TTC au particulier et au visiteur (P2, P3)', () => {
		expect(priceDisplayMode('particulier')).toBe('ttc');
		expect(priceDisplayMode(null)).toBe('ttc');
	});

	it('affiche le HT au professionnel et à la collectivité (P2)', () => {
		expect(priceDisplayMode('pro')).toBe('ht');
		expect(priceDisplayMode('collectivite')).toBe('ht');
	});

	it('reste indépendant du régime fiscal : un pro français voit le HT et paie la TVA', () => {
		const profile = { country: 'FR', type: 'pro' as const };
		expect(priceDisplayMode(profile.type)).toBe('ht');
		expect(resolveTaxRegime(profile)).toBe('standard');
	});
});

describe('TAX_MENTIONS', () => {
	it('porte une mention légale sur chaque régime exonéré (R17)', () => {
		expect(TAX_MENTIONS.export_outside_eu).toContain('262 ter');
		expect(TAX_MENTIONS.reverse_charge_eu).toContain('283-2');
		expect(TAX_MENTIONS.standard).toBeNull();
	});
});

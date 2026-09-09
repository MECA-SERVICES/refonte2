import { describe, expect, it } from 'vitest';
import {
	cartDimensionsCm,
	cartWeightKg,
	extraShippingFee,
	fallbackOptions,
	forcedCarrierCode,
	DEFAULT_LINE_WEIGHT_KG,
	FALLBACK_GRID,
	type ShippableLine
} from './shipping';

const line = (over: Partial<ShippableLine> = {}): ShippableLine => ({
	quantity: 1,
	weightKg: 1,
	lengthCm: null,
	widthCm: null,
	heightCm: null,
	shippingExtraFee: null,
	...over
});

describe('cartWeightKg', () => {
	it('somme les poids multipliés par les quantités (R1)', () => {
		expect(cartWeightKg([line({ weightKg: 2.5, quantity: 2 }), line({ weightKg: 1.2 })])).toBe(6.2);
	});

	it('arrondit au centième (R1)', () => {
		expect(cartWeightKg([line({ weightKg: 0.333, quantity: 3 })])).toBe(1);
	});

	it('remplace un poids absent par le plancher : Sendcloud refuse un poids nul', () => {
		expect(cartWeightKg([line({ weightKg: null }), line({ weightKg: 2 })])).toBe(2.1);
	});

	it('ne descend jamais à zéro, même sans aucun poids renseigné', () => {
		expect(cartWeightKg([line({ weightKg: null })])).toBe(DEFAULT_LINE_WEIGHT_KG);
	});
});

describe('cartDimensionsCm', () => {
	it('retient le maximum de chaque dimension (R3)', () => {
		expect(
			cartDimensionsCm([
				line({ lengthCm: 40, widthCm: 20, heightCm: 10 }),
				line({ lengthCm: 30, widthCm: 35, heightCm: 5 })
			])
		).toEqual({ length: 40, width: 35, height: 10 });
	});

	it('ne renvoie rien si une dimension manque : Sendcloud les veut toutes', () => {
		expect(cartDimensionsCm([line({ lengthCm: 40, widthCm: 20 })])).toBeUndefined();
		expect(cartDimensionsCm([line()])).toBeUndefined();
	});
});

describe('extraShippingFee', () => {
	it('cumule le surcoût unitaire sur tout le panier (R9)', () => {
		expect(
			extraShippingFee([
				line({ shippingExtraFee: 12.5, quantity: 2 }),
				line({ shippingExtraFee: 5 })
			])
		).toBe(30);
	});

	it('vaut zéro sans surcoût déclaré', () => {
		expect(extraShippingFee([line(), line()])).toBe(0);
	});
});

describe('forcedCarrierCode', () => {
	it('impose le transporteur déclaré sur un article (R5)', () => {
		expect(forcedCarrierCode([line(), line({ forcedCarrierCode: 'colissimo' })], 3)).toBe(
			'colissimo'
		);
	});

	it("impose le transporteur d'un article dont le seuil de poids est atteint (R6)", () => {
		const lines = [line({ forcedCarrierCode: 'dhl', minWeightThresholdKg: 30, weightKg: null })];
		expect(forcedCarrierCode(lines, 35)).toBe('dhl');
	});

	it('ne l’impose pas tant que le seuil n’est pas atteint', () => {
		const lines = [line({ forcedCarrierCode: 'dhl', minWeightThresholdKg: 30, weightKg: null })];
		expect(forcedCarrierCode(lines, 12)).toBeNull();
	});

	it('ne renvoie rien quand aucune contrainte ne s’applique', () => {
		expect(forcedCarrierCode([line(), line()], 5)).toBeNull();
	});
});

describe('fallbackOptions', () => {
	it('choisit la tranche de poids correspondante (R19)', () => {
		expect(fallbackOptions(1.5)[0].priceHt).toBe(FALLBACK_GRID[0].priceHt);
		expect(fallbackOptions(7)[0].priceHt).toBe(FALLBACK_GRID[2].priceHt);
	});

	it('retombe sur la dernière tranche pour un colis hors grille', () => {
		expect(fallbackOptions(500)[0].priceHt).toBe(FALLBACK_GRID.at(-1)!.priceHt);
	});

	it('signale l’offre comme issue du repli, pour alerter le back-office (R20)', () => {
		expect(fallbackOptions(3)[0].fallback).toBe(true);
	});
});

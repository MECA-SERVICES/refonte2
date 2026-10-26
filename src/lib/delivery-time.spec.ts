import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DELIVERY_TIME,
	cartShippingEstimate,
	estimateShippingWindow,
	normalizeDeliveryMode,
	resolveDeliveryTime
} from './delivery-time';

describe('normalizeDeliveryMode', () => {
	it('laisse passer les trois régimes', () => {
		expect(normalizeDeliveryMode('none')).toBe('none');
		expect(normalizeDeliveryMode('default')).toBe('default');
		expect(normalizeDeliveryMode('specific')).toBe('specific');
	});

	it('retombe sur le régime par défaut, jamais sur « aucun »', () => {
		// Un produit mal configuré doit annoncer un délai, pas se taire.
		expect(normalizeDeliveryMode(null)).toBe('default');
		expect(normalizeDeliveryMode('')).toBe('default');
		expect(normalizeDeliveryMode('inconnu')).toBe('default');
	});
});

describe('resolveDeliveryTime', () => {
	it('n’affiche rien en régime « aucun »', () => {
		const p = { deliveryTimeMode: 'none', deliveryTimeInStock: 'Sous 24 h' };
		expect(resolveDeliveryTime(p, true)).toBeNull();
		expect(resolveDeliveryTime(p, false)).toBeNull();
	});

	it('emploie les messages de la boutique en régime par défaut', () => {
		const p = { deliveryTimeMode: 'default' };
		expect(resolveDeliveryTime(p, true)).toBe(DEFAULT_DELIVERY_TIME.inStock);
		expect(resolveDeliveryTime(p, false)).toBe(DEFAULT_DELIVERY_TIME.outOfStock);
	});

	it('ignore un message propre tant que le régime reste « par défaut »', () => {
		// Le régime commande, pas la présence du texte : sans quoi une saisie
		// oubliée s'afficherait à l'insu de l'utilisateur.
		const p = {
			deliveryTimeMode: 'default',
			deliveryTimeInStock: 'Message oublié'
		};
		expect(resolveDeliveryTime(p, true)).toBe(DEFAULT_DELIVERY_TIME.inStock);
	});

	it('emploie le message du produit en régime spécifique', () => {
		const p = {
			deliveryTimeMode: 'specific',
			deliveryTimeInStock: 'EXPEDITION SOUS 24H A 48H',
			deliveryTimeOutOfStock: 'EXPEDITION 5 A 10 JOURS*'
		};
		expect(resolveDeliveryTime(p, true)).toBe('EXPEDITION SOUS 24H A 48H');
		expect(resolveDeliveryTime(p, false)).toBe('EXPEDITION 5 A 10 JOURS*');
	});

	it('permet la mention « nous contacter » sans champ dédié', () => {
		const p = { deliveryTimeMode: 'specific', deliveryTimeOutOfStock: 'Nous consulter' };
		expect(resolveDeliveryTime(p, false)).toBe('Nous consulter');
	});

	it('désactive l’affichage sur un message spécifique vide', () => {
		// « Laisser vide pour désactiver », comme chez PrestaShop.
		const p = {
			deliveryTimeMode: 'specific',
			deliveryTimeInStock: '   ',
			deliveryTimeOutOfStock: null
		};
		expect(resolveDeliveryTime(p, true)).toBeNull();
		expect(resolveDeliveryTime(p, false)).toBeNull();
	});

	it('traite un produit sans réglage comme le régime par défaut', () => {
		// Cas de toutes les fiches existantes avant la migration.
		expect(resolveDeliveryTime({}, true)).toBe(DEFAULT_DELIVERY_TIME.inStock);
	});
});

describe('estimateShippingWindow', () => {
	// Lundi 26 octobre 2026.
	const monday = new Date(2026, 9, 26, 10);
	const day = (d: Date) => d.toISOString().slice(0, 10);

	it('compte les heures en jours ouvrés', () => {
		const w = estimateShippingWindow('Expédition sous 24 à 48 h ouvrées', monday);
		expect(w && [day(w.earliest), day(w.latest)]).toEqual(['2026-10-27', '2026-10-28']);
	});

	it('saute le week-end', () => {
		const w = estimateShippingWindow('Expédition sous 5 à 10 jours ouvrés', monday);
		expect(w && [day(w.earliest), day(w.latest)]).toEqual(['2026-11-02', '2026-11-09']);
	});

	it('accepte une durée unique', () => {
		const w = estimateShippingWindow('Expédition sous 3 jours', monday);
		expect(w && day(w.earliest)).toBe(day(w!.latest));
	});

	it('ne promet rien sans durée lisible', () => {
		expect(estimateShippingWindow('Nous consulter', monday)).toBeNull();
		expect(estimateShippingWindow(null, monday)).toBeNull();
	});
});

describe('cartShippingEstimate', () => {
	const monday = new Date(2026, 9, 26, 10);
	const day = (d: Date | null) => d?.toISOString().slice(0, 10);

	it('retient le délai le plus long du panier', () => {
		const e = cartShippingEstimate(
			[
				{ stock: 3, deliveryTimeMode: 'default' },
				{ stock: 1, deliveryTimeMode: 'specific', deliveryTimeInStock: 'Expédition sous 5 jours' }
			],
			monday
		);
		expect(e.message).toBe('Expédition sous 5 jours');
		expect(day(e.latest)).toBe('2026-11-02');
	});

	it('prend le délai de la boutique quand aucun article n’en donne', () => {
		const e = cartShippingEstimate([{ stock: 2, deliveryTimeMode: 'none' }], monday);
		expect(e.message).toBe(DEFAULT_DELIVERY_TIME.inStock);
		expect(day(e.latest)).toBe('2026-10-28');
	});
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_DELIVERY_TIME, normalizeDeliveryMode, resolveDeliveryTime } from './delivery-time';

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

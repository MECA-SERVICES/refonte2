import { describe, expect, it } from 'vitest';
import {
	isBusinessType,
	normalizeCustomerStatus,
	normalizeCustomerType,
	requiresValidation
} from './accounts';

describe('normalizeCustomerType', () => {
	it('laisse passer le vocabulaire du CDC', () => {
		expect(normalizeCustomerType('particulier')).toBe('particulier');
		expect(normalizeCustomerType('pro')).toBe('pro');
		expect(normalizeCustomerType('collectivite')).toBe('collectivite');
	});

	it('ramène les valeurs héritées de PrestaShop', () => {
		expect(normalizeCustomerType('individual')).toBe('particulier');
		expect(normalizeCustomerType('professional')).toBe('pro');
	});

	it('ramène la valeur de l’ancien schéma', () => {
		expect(normalizeCustomerType('entreprise')).toBe('pro');
	});

	it('tolère la casse et les espaces', () => {
		expect(normalizeCustomerType('  Professional ')).toBe('pro');
	});

	it('retombe sur particulier pour une valeur inconnue ou absente', () => {
		expect(normalizeCustomerType(null)).toBe('particulier');
		expect(normalizeCustomerType('inconnu')).toBe('particulier');
	});
});

describe('normalizeCustomerStatus', () => {
	it('laisse passer le vocabulaire du CDC', () => {
		expect(normalizeCustomerStatus('pending')).toBe('pending');
		expect(normalizeCustomerStatus('validated')).toBe('validated');
		expect(normalizeCustomerStatus('rejected')).toBe('rejected');
	});

	it('ramène les statuts hérités', () => {
		expect(normalizeCustomerStatus('active')).toBe('validated');
		expect(normalizeCustomerStatus('inactive')).toBe('rejected');
	});

	it('retombe sur pending, jamais sur validated', () => {
		// Le défaut prudent : un statut inconnu ne doit pas ouvrir de droits.
		expect(normalizeCustomerStatus(null)).toBe('pending');
		expect(normalizeCustomerStatus('n’importe quoi')).toBe('pending');
	});
});

describe('isBusinessType', () => {
	it('reconnaît les professionnels et collectivités, quel que soit le vocabulaire', () => {
		expect(isBusinessType('pro')).toBe(true);
		expect(isBusinessType('professional')).toBe(true);
		expect(isBusinessType('entreprise')).toBe(true);
		expect(isBusinessType('collectivite')).toBe(true);
	});

	it('écarte les particuliers et les visiteurs', () => {
		expect(isBusinessType('particulier')).toBe(false);
		expect(isBusinessType('individual')).toBe(false);
		expect(isBusinessType(null)).toBe(false);
	});
});

describe('requiresValidation', () => {
	it('n’ouvre une demande que pour un compte non particulier (R1, R2)', () => {
		expect(requiresValidation('pro')).toBe(true);
		expect(requiresValidation('collectivite')).toBe(true);
		expect(requiresValidation('particulier')).toBe(false);
	});
});

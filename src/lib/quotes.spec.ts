import { describe, expect, it } from 'vitest';
import { quoteStatus, validUntilOf } from './quotes';
import { formatCounterNumber } from './counter-invoices';

describe('devis', () => {
	it('calcule la date limite depuis la date d’émission (R3)', () => {
		expect(validUntilOf('2026-10-13', 15)).toBe('2026-10-28');
		expect(validUntilOf('2026-12-25', 15)).toBe('2027-01-09');
	});

	it('déduit l’expiration de la date limite (R4)', () => {
		const sent = { status: 'sent' as const, validUntil: '2026-10-28' };
		expect(quoteStatus(sent, '2026-10-28')).toBe('sent');
		expect(quoteStatus(sent, '2026-10-29')).toBe('expired');
		expect(quoteStatus({ ...sent, status: 'accepted' }, '2026-11-30')).toBe('accepted');
		expect(quoteStatus({ status: 'draft', validUntil: null }, '2030-01-01')).toBe('draft');
	});

	it('numérote dans la série Dolibarr', () => {
		expect(formatCounterNumber('PR', new Date(2026, 10, 3), 322)).toBe('PR2611-0322');
	});
});

import { describe, it, expect } from 'vitest';
import { parseSettlementForm } from './settlements';
import { buildSettlementReference, remainingDue } from '$lib/settlements';

function formOf(fields: Record<string, string>) {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return form;
}

describe('saisie d’un règlement', () => {
	it('accepte un chèque complet', () => {
		const parsed = parseSettlementForm(
			formOf({
				method: 'cheque',
				amount: '120,5',
				receivedOn: '2026-10-26',
				chequeNumber: ' 1234567 ',
				chequeIssuer: 'Jean Martin',
				chequeBank: 'Crédit Agricole'
			})
		);
		expect(parsed).toEqual({
			ok: true,
			values: {
				method: 'cheque',
				amount: '120.50',
				receivedOn: '2026-10-26',
				chequeNumber: '1234567',
				chequeIssuer: 'Jean Martin',
				chequeBank: 'Crédit Agricole'
			}
		});
	});

	it('exige le numéro d’un chèque', () => {
		const parsed = parseSettlementForm(
			formOf({ method: 'cheque', amount: '10', receivedOn: '2026-10-26' })
		);
		expect(parsed.ok).toBe(false);
	});

	it('ignore les champs du chèque pour des espèces', () => {
		const parsed = parseSettlementForm(
			formOf({ method: 'cash', amount: '10', receivedOn: '2026-10-26', chequeNumber: '99' })
		);
		expect(parsed.ok && parsed.values.chequeNumber).toBe(null);
	});

	it('refuse un mode inconnu, un montant nul ou une date illisible', () => {
		expect(
			parseSettlementForm(formOf({ method: 'paypal', amount: '10', receivedOn: '2026-10-26' })).ok
		).toBe(false);
		expect(
			parseSettlementForm(formOf({ method: 'cash', amount: '0', receivedOn: '2026-10-26' })).ok
		).toBe(false);
		expect(
			parseSettlementForm(formOf({ method: 'cash', amount: '10', receivedOn: '26/10/2026' })).ok
		).toBe(false);
	});
});

describe('reste à régler', () => {
	it('déduit les règlements au centime', () => {
		expect(remainingDue('100.00', ['33.33', '33.33'])).toBe(33.34);
	});

	it('ne descend jamais sous zéro', () => {
		expect(remainingDue('50', ['60'])).toBe(0);
	});
});

describe('référence d’un règlement', () => {
	it('suit le format Dolibarr PAYAAMM-NNNN', () => {
		expect(buildSettlementReference(42, '2026-10-26')).toBe('PAY2610-0042');
		expect(buildSettlementReference(12345, '2027-01-03')).toBe('PAY2701-12345');
	});
});

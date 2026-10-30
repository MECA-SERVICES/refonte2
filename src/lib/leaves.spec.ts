import { describe, expect, it } from 'vitest';
import {
	formatDays,
	isWorkingDay,
	leaveDays,
	leaveReference,
	monthsToAccrue,
	publicHolidays
} from './leaves';

describe('congés', () => {
	it('connaît les jours fériés, Pâques compris', () => {
		const h = publicHolidays(2026);
		expect(h.has('2026-04-06')).toBe(true); // lundi de Pâques
		expect(h.has('2026-05-14')).toBe(true); // Ascension
		expect(h.has('2026-05-25')).toBe(true); // lundi de Pentecôte
		expect(h.has('2026-11-11')).toBe(true);
		expect(isWorkingDay('2026-10-31')).toBe(false); // samedi
		expect(isWorkingDay('2026-10-30')).toBe(true);
	});

	it('décompte les jours ouvrés', () => {
		// Du lundi 26 au jeudi 29 octobre 2026.
		expect(leaveDays('2026-10-26', '2026-10-29')).toBe(4);
		// Une semaine avec le 11 novembre (mercredi).
		expect(leaveDays('2026-11-09', '2026-11-15')).toBe(4);
		expect(leaveDays('2026-10-30', '2026-10-26')).toBe(0);
	});

	it('compte les demi-journées', () => {
		expect(leaveDays('2026-10-26', '2026-10-29', true)).toBe(3.5);
		expect(leaveDays('2026-10-26', '2026-10-29', true, true)).toBe(3);
		expect(leaveDays('2026-10-23', '2026-10-23', false, true)).toBe(0.5);
		expect(leaveDays('2026-10-23', '2026-10-23', true, true)).toBe(0.5);
	});

	it('compte les mois à acquérir', () => {
		expect(monthsToAccrue('2026-10', '2026-10-30')).toBe(0);
		expect(monthsToAccrue('2026-10', '2026-11-01')).toBe(1);
		expect(monthsToAccrue('2025-12', '2026-02-15')).toBe(2);
	});

	it('numérote et affiche comme Dolibarr', () => {
		expect(leaveReference(new Date(2026, 10, 2), 171)).toBe('HL2611-0171');
		expect(formatDays(1)).toBe('1 jour');
		expect(formatDays(2.5)).toBe('2,5 jours');
	});
});

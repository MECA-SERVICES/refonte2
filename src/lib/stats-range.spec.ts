import { describe, expect, it } from 'vitest';
import {
	lastYearRange,
	parseStatsSelection,
	presetRange,
	previousRange,
	rangeLength
} from './stats-range';

// Lundi 26 octobre 2026.
const today = new Date(2026, 9, 26, 15);

describe('périodes des statistiques', () => {
	it('calcule les raccourcis, bornes comprises', () => {
		expect(presetRange('7j', today)).toEqual({ from: '2026-10-20', to: '2026-10-26' });
		expect(presetRange('mois', today)).toEqual({ from: '2026-10-01', to: '2026-10-26' });
		expect(presetRange('mois-precedent', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
		expect(presetRange('annee', today)).toEqual({ from: '2026-01-01', to: '2026-10-26' });
		expect(rangeLength(presetRange('30j', today))).toBe(30);
	});

	it('compare à la période précédente de même durée', () => {
		expect(previousRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({
			from: '2026-08-31',
			to: '2026-09-30'
		});
	});

	it("compare à la même période l'an dernier", () => {
		expect(lastYearRange({ from: '2026-10-01', to: '2026-10-26' })).toEqual({
			from: '2025-10-01',
			to: '2025-10-26'
		});
		expect(lastYearRange({ from: '2028-02-29', to: '2028-02-29' })).toEqual({
			from: '2027-02-28',
			to: '2027-02-28'
		});
	});

	it('lit les dates personnalisées, même inversées', () => {
		const s = parseStatsSelection(
			new URLSearchParams(
				'periode=perso&du=2026-10-10&au=2026-10-01&comparer=perso&cdu=2025-10-01&cau=2025-10-10'
			),
			today
		);
		expect(s.range).toEqual({ from: '2026-10-01', to: '2026-10-10' });
		expect(s.compare).toEqual({ from: '2025-10-01', to: '2025-10-10' });
	});

	it('retombe sur 30 jours face à une saisie illisible ou démesurée', () => {
		const bad = parseStatsSelection(new URLSearchParams('periode=perso&du=hier'), today);
		expect(bad.preset).toBe('30j');
		const huge = parseStatsSelection(
			new URLSearchParams('periode=perso&du=2000-01-01&au=2026-01-01'),
			today
		);
		expect(huge.preset).toBe('30j');
	});
});

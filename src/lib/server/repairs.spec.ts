import { describe, it, expect } from 'vitest';
import {
	canTransition,
	isFrozen,
	nextStatuses,
	buildRepairReference,
	REPAIR_STATUS_LABELS,
	REPAIR_TYPE_LABELS
} from './repairs';
import { repairStatuses } from './db/repair.schema';

describe('cycle de vie (CDC 31, §5)', () => {
	it('autorise les transitions du tableau', () => {
		expect(canTransition('to_do', 'in_progress')).toBe(true);
		expect(canTransition('in_progress', 'on_hold')).toBe(true);
		expect(canTransition('in_progress', 'completed')).toBe(true);
		expect(canTransition('on_hold', 'in_progress')).toBe(true);
		expect(canTransition('completed', 'delivered')).toBe(true);
	});

	it('refuse toute transition absente du tableau', () => {
		// « Toute transition absente de ce tableau est refusée. »
		expect(canTransition('to_do', 'completed')).toBe(false);
		expect(canTransition('on_hold', 'completed')).toBe(false);
		expect(canTransition('delivered', 'in_progress')).toBe(false);
		expect(canTransition('cancelled', 'in_progress')).toBe(false);
	});

	it("n'annule plus un ordre achevé (R20)", () => {
		// Une correction après achèvement impose un nouvel ordre.
		expect(canTransition('completed', 'cancelled')).toBe(false);
	});

	it('impose de repasser par « en cours » après une suspension', () => {
		expect(nextStatuses('on_hold')).toEqual(['in_progress', 'cancelled']);
	});

	it('marque les états terminaux comme figés (R17)', () => {
		expect(isFrozen('completed')).toBe(true);
		expect(isFrozen('delivered')).toBe(true);
		expect(isFrozen('cancelled')).toBe(true);
		expect(isFrozen('to_do')).toBe(false);
		expect(isFrozen('in_progress')).toBe(false);
		expect(isFrozen('on_hold')).toBe(false);
	});

	it('ne laisse aucune sortie aux états terminaux', () => {
		expect(nextStatuses('delivered')).toEqual([]);
		expect(nextStatuses('cancelled')).toEqual([]);
	});
});

describe('libellés', () => {
	it('couvre tous les états en français', () => {
		for (const status of repairStatuses) {
			const label = REPAIR_STATUS_LABELS[status];
			expect(label).toBeTruthy();
			// Aucun code technique ne doit remonter à l'écran.
			expect(label).not.toBe(status);
		}
	});

	it('nomme les deux prises en charge en français', () => {
		expect(REPAIR_TYPE_LABELS.paid).toBe('Payante');
		expect(REPAIR_TYPE_LABELS.warranty).toBe('Sous garantie');
	});
});

describe('référence', () => {
	it('suit le format OR-année-suffixe', () => {
		expect(buildRepairReference()).toMatch(/^OR-\d{4}-[A-Z0-9]{6}$/);
	});

	it('ne se répète pas', () => {
		const refs = new Set(Array.from({ length: 200 }, () => buildRepairReference()));
		expect(refs.size).toBeGreaterThan(190);
	});
});

describe('règles bloquantes', () => {
	it("n'accepte pas un ordre sous garantie sans référence de dossier (R14)", async () => {
		const { createRepairOrder, RepairError } = await import('./repairs');
		await expect(
			createRepairOrder({ customerId: 1, orderType: 'warranty' })
		).rejects.toBeInstanceOf(RepairError);
	});
});

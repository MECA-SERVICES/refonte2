import { describe, expect, it } from 'vitest';
import { assignSerials, conditionOf, splitByCondition } from './conditions.ts';

describe('états du stock UTILE', () => {
	it('traduit les types 1, 2, 3', () => {
		expect([1, 2, 3, null].map(conditionOf)).toEqual(['new', 'used', 'warranty', 'new']);
	});

	it('répartit une ligne de stock, la quantité de la ligne faisant foi', () => {
		expect(
			splitByCondition(5, [
				{ type: 1, quantity: 3 },
				{ type: 2, quantity: 2 }
			])
		).toEqual([
			{ condition: 'new', quantity: 3 },
			{ condition: 'used', quantity: 2 }
		]);
		// Reste non typé : neuf.
		expect(splitByCondition(4, [{ type: 3, quantity: 1 }])).toEqual([
			{ condition: 'new', quantity: 3 },
			{ condition: 'warranty', quantity: 1 }
		]);
		// Excédent typé : retiré du neuf d'abord.
		expect(
			splitByCondition(2, [
				{ type: 1, quantity: 2 },
				{ type: 2, quantity: 1 }
			])
		).toEqual([
			{ condition: 'new', quantity: 1 },
			{ condition: 'used', quantity: 1 }
		]);
		expect(splitByCondition(0, [])).toEqual([]);
	});

	it('répartit les numéros de série entre les états, le surplus restant hors stock', () => {
		expect(
			assignSerials(
				['A', 'B', 'C'],
				[
					{ condition: 'used', quantity: 1 },
					{ condition: 'warranty', quantity: 2 }
				]
			)
		).toEqual([
			{ serial: 'A', condition: 'used' },
			{ serial: 'B', condition: 'warranty' },
			{ serial: 'C', condition: 'warranty' }
		]);
		expect(assignSerials(['A', 'B'], [{ condition: 'new', quantity: 1 }])).toEqual([
			{ serial: 'A', condition: 'new' },
			{ serial: 'B', condition: null }
		]);
		expect(assignSerials(['A'], [])).toEqual([{ serial: 'A', condition: null }]);
	});
});

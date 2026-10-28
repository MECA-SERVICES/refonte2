import { describe, expect, it } from 'vitest';
import { parseTransferForm } from './stock-locations';

function form(toId: string, lines: [number, number, number][], reference = '') {
	const data = new FormData();
	data.set('toId', toId);
	data.set('reference', reference);
	for (const [productId, fromId, quantity] of lines) {
		data.append('productId', String(productId));
		data.append('fromId', String(fromId));
		data.append('quantity', String(quantity));
	}
	return data;
}

describe('parseTransferForm', () => {
	it('lit la destination, la pièce et les lignes dans l’ordre', () => {
		const parsed = parseTransferForm(
			form(
				'9',
				[
					[1, 4, 2],
					[2, 5, 1]
				],
				' BS-12 '
			)
		);
		expect(parsed).toEqual({
			ok: true,
			values: {
				toId: 9,
				reference: 'BS-12',
				lines: [
					{ productId: 1, fromId: 4, condition: 'new', quantity: 2, serials: [] },
					{ productId: 2, fromId: 5, condition: 'new', quantity: 1, serials: [] }
				]
			}
		});
	});

	it('refuse une destination absente, une quantité nulle, un doublon ou un produit déjà sur place', () => {
		expect(parseTransferForm(form('', [[1, 4, 2]])).ok).toBe(false);
		expect(parseTransferForm(form('9', [[1, 4, 0]])).ok).toBe(false);
		expect(
			parseTransferForm(
				form('9', [
					[1, 4, 1],
					[1, 4, 1]
				])
			).ok
		).toBe(false);
		expect(parseTransferForm(form('4', [[1, 4, 1]])).ok).toBe(false);
		expect(parseTransferForm(form('9', [])).ok).toBe(false);
	});

	it('garde l’état et les numéros de série cochés de chaque ligne', () => {
		const data = form('9', [
			[1, 4, 2],
			[2, 5, 1]
		]);
		data.append('condition', 'used');
		data.append('condition', 'new');
		data.append('serials', '0:SN-1');
		const parsed = parseTransferForm(data);
		expect(parsed.ok && parsed.values.lines[0]).toMatchObject({
			condition: 'used',
			serials: ['SN-1']
		});
		expect(parsed.ok && parsed.values.lines[1].serials).toEqual([]);
	});
});

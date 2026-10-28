import { describe, expect, it } from 'vitest';
import { parseVoucherForm } from './stock-vouchers';

/** Formulaire de bon : en-tête puis lignes [produit, emplacement, état, qté, repart]. */
function form(
	lines: [number, number, string, number, number][],
	extra: Record<string, string> = {}
) {
	const data = new FormData();
	for (const [k, v] of Object.entries(extra)) data.set(k, v);
	for (const [productId, locationId, condition, quantity, immediate] of lines) {
		data.append('productId', String(productId));
		data.append('locationId', String(locationId));
		data.append('condition', condition);
		data.append('quantity', String(quantity));
		data.append('immediate', String(immediate));
	}
	return data;
}

describe('parseVoucherForm', () => {
	it('lit le BL, le fournisseur et les lignes avec leurs numéros de série', () => {
		const data = form(
			[
				[1, 10, 'new', 3, 1],
				[2, 11, 'used', 1, 0]
			],
			{ reference: ' LCL2205 ', supplier: 'KRAMP' }
		);
		data.append('serials', '1:SN-9');
		const parsed = parseVoucherForm(data, 'receipt');
		expect(parsed).toMatchObject({
			ok: true,
			values: {
				reference: 'LCL2205',
				supplier: 'KRAMP',
				lines: [
					{
						productId: 1,
						locationId: 10,
						condition: 'new',
						quantity: 3,
						immediate: 1,
						serials: []
					},
					{
						productId: 2,
						locationId: 11,
						condition: 'used',
						quantity: 1,
						immediate: 0,
						serials: ['SN-9']
					}
				]
			}
		});
	});

	it('refuse un emplacement manquant, trop de départs immédiats ou de numéros', () => {
		expect(parseVoucherForm(form([[1, 0, 'new', 1, 0]]), 'receipt').ok).toBe(false);
		expect(parseVoucherForm(form([[1, 10, 'new', 2, 3]]), 'receipt').ok).toBe(false);
		const tooMany = form([[1, 10, 'new', 1, 0]]);
		tooMany.append('serials', '0:A');
		tooMany.append('serials', '0:B');
		expect(parseVoucherForm(tooMany, 'receipt').ok).toBe(false);
		expect(parseVoucherForm(new FormData(), 'issue').ok).toBe(false);
	});

	it('ignore le départ immédiat et lit le motif pour une sortie', () => {
		const parsed = parseVoucherForm(
			form([[1, 10, 'new', 2, 2]], { reason: 'consumable' }),
			'issue'
		);
		expect(parsed.ok && parsed.values.reason).toBe('consumable');
		expect(parsed.ok && parsed.values.lines[0].immediate).toBe(0);
	});
});

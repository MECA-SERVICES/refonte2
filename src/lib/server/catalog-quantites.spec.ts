import { describe, expect, it } from 'vitest';
import { parseProductForm } from './catalog';

function form(fields: Record<string, string>) {
	const d = new FormData();
	for (const [k, v] of Object.entries(fields)) d.set(k, v);
	return d;
}

const base = { name: 'Test', reference: 'REF-1', priceHt: '10' };

describe('parseProductForm — quantités', () => {
	it('lit les quatre champs', () => {
		const out = parseProductForm(
			form({
				...base,
				stock: '42',
				minOrderQuantity: '10',
				stockLocation: 'Allée B',
				lowStockThreshold: '5',
				availableDate: '2026-12-01'
			})
		);
		expect(out).toMatchObject({ ok: true });
		if (!out.ok) return;
		expect(out.values.stock).toBe(42);
		expect(out.values.minOrderQuantity).toBe(10);
		expect(out.values.stockLocation).toBe('Allée B');
		expect(out.values.lowStockThreshold).toBe(5);
		expect(out.values.availableDate?.toISOString().slice(0, 10)).toBe('2026-12-01');
	});

	it('impose un minimum de vente >= 1', () => {
		for (const v of ['0', '-5', '', 'abc']) {
			const out = parseProductForm(form({ ...base, minOrderQuantity: v }));
			expect(out.ok && out.values.minOrderQuantity).toBe(1);
		}
	});

	it('refuse un seuil negatif', () => {
		const out = parseProductForm(form({ ...base, lowStockThreshold: '-3' }));
		expect(out.ok && out.values.lowStockThreshold).toBe(0);
	});

	it('traite une date illisible comme absente', () => {
		const out = parseProductForm(form({ ...base, availableDate: 'pas-une-date' }));
		expect(out.ok && out.values.availableDate).toBeNull();
	});

	it('applique les defauts quand les champs sont absents', () => {
		const out = parseProductForm(form(base));
		expect(out.ok && out.values.minOrderQuantity).toBe(1);
		expect(out.ok && out.values.lowStockThreshold).toBe(0);
		expect(out.ok && out.values.stockLocation).toBeNull();
	});
});

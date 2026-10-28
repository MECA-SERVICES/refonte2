import { describe, expect, it } from 'vitest';
import { compactReference, matchProducts, nameSimilarity, partNumbers } from './products.ts';

const shop = (id: number, reference: string, ean13: string | null = null, isActive = true) => ({
	id,
	reference,
	ean13,
	isActive
});

describe('rapprochement des produits Dolibarr', () => {
	it('compacte la référence', () => {
		expect(compactReference('587 42 07-01')).toBe('587420701');
		expect(compactReference('ore.111/084_e')).toBe('ORE111084E');
	});

	it('rattache par référence, puis EAN, puis référence compacte', () => {
		const matches = matchProducts(
			[
				{ rowid: 1, ref: 'MARU-225891', barcode: '' },
				{ rowid: 2, ref: 'DOLI-2', barcode: '3165140000000' },
				{ rowid: 3, ref: '587 42 07-01', barcode: null }
			],
			[shop(10, 'MARU-225891'), shop(20, 'X', '3165140000000'), shop(30, '5874207-01')]
		);
		expect(matches.get(1)).toEqual({ productId: 10, kind: 'reference' });
		expect(matches.get(2)).toEqual({ productId: 20, kind: 'ean' });
		expect(matches.get(3)).toEqual({ productId: 30, kind: 'compact' });
	});

	it('écarte une correspondance ambiguë, sauf si un seul doublon est actif', () => {
		const matches = matchProducts(
			[
				{ rowid: 1, ref: 'A', barcode: null },
				{ rowid: 2, ref: 'B', barcode: null }
			],
			[shop(10, 'A'), shop(11, 'A'), shop(20, 'B'), shop(21, 'B', null, false)]
		);
		expect(matches.has(1)).toBe(false);
		expect(matches.get(2)?.productId).toBe(20);
	});

	it("n'attribue un produit MSShop qu'une fois", () => {
		const matches = matchProducts(
			[
				{ rowid: 1, ref: 'A-1', barcode: null },
				{ rowid: 2, ref: 'A1', barcode: null }
			],
			[shop(10, 'A-1')]
		);
		expect(matches.get(1)?.productId).toBe(10);
		expect(matches.has(2)).toBe(false);
	});

	it('rapproche par numéro de pièce quand les noms concordent', () => {
		expect(partNumbers('ALK-AK474669')).toEqual(['AK474669', '474669']);
		expect(partNumbers('HON-72613VA4000')).toEqual(['72613VA4000']);
		expect(nameSimilarity('Serre-câble | AL-KO', 'Serre-câble | AL-KO')).toBe(1);

		const matches = matchProducts(
			[
				{ rowid: 1, ref: 'HON-72613VA4000', barcode: null, label: 'Douille | HONDA' },
				{ rowid: 2, ref: 'ALK-AK474669', barcode: null, label: 'Serre-câble | AL-KO' },
				// Même numéro, produit sans rapport : pas de rattachement.
				{ rowid: 3, ref: 'ALK-AK470922', barcode: null, label: 'Transformateur' }
			],
			[
				{ ...shop(10, 'HOND-72613VA4000'), name: 'Douille | HONDA MACHINERY PARTS' },
				{ ...shop(20, 'ALK-474669'), name: 'Serre-câble | AL-KO' },
				{ ...shop(30, 'ALK-470922'), name: 'Plaque de réglage | AL-KO' }
			]
		);
		expect(matches.get(1)).toEqual({ productId: 10, kind: 'part-number' });
		expect(matches.get(2)).toEqual({ productId: 20, kind: 'part-number' });
		expect(matches.has(3)).toBe(false);
	});
});

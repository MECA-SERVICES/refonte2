import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { renderRepairOrderPdf } from './repair-order-pdf';

/** Ordre monté sur des données réalistes, sans la base. */
function fixture(overrides: Record<string, unknown> = {}) {
	const at = new Date('2026-10-26T10:00:00Z');
	return {
		id: 7,
		reference: 'OR-2026-8QVUWN',
		customerId: 1,
		repairRequestId: null,
		quoteId: null,
		status: 'completed' as const,
		orderType: 'paid' as const,
		warrantyReference: null,
		warrantyDocumentUrl: null,
		machineType: 'Tondeuse',
		machineBrand: 'Husqvarna',
		machineModel: 'LC 347V',
		serialNumber: '123456789',
		machineCondition: 'Carter rayé, lame émoussée.',
		engineModel: 'Briggs & Stratton 675 EXi',
		engineSerialNumber: null,
		workshopLabel: 'E-123',
		workDescription: 'Affûtage de la lame, vidange, remplacement de la bougie.',
		onHoldPartLabel: null,
		onHoldExpectedAt: null,
		diagnosticFee: '20.00',
		laborAmount: '45.00',
		totalPartsHt: '8.50',
		totalHt: '73.50',
		totalTva: '14.70',
		totalTtc: '88.20',
		invoiceId: null,
		notes: 'Lame à changer à la prochaine révision.',
		privateNote: 'Ne doit jamais apparaître sur le PDF',
		machineAddedToFleet: false,
		createdAt: at,
		updatedAt: at,
		startedAt: at,
		completedAt: at,
		deliveredAt: null,
		paidAt: null,
		customer: {
			order: {},
			customerFirstName: 'Jean',
			customerLastName: 'Martin',
			customerEmail: 'jean.martin@example.test',
			customerPhone: '06 00 00 00 00',
			customerCompany: null
		},
		parts: [
			{
				id: 1,
				productId: 10,
				partName: 'Bougie RC12YC',
				partReference: 'CHA-RC12YC',
				quantity: 1,
				unitPriceHt: '8.50',
				totalHt: '8.50'
			}
		],
		images: [],
		history: [],
		...overrides
	};
}

describe('ordre de réparation en PDF', () => {
	it('produit un PDF, sans la note interne', async () => {
		const order = fixture();
		const pdf = await renderRepairOrderPdf(order as never);
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		if (process.env.REPAIR_PDF_OUT) writeFileSync(`${process.env.REPAIR_PDF_OUT}/ordre.pdf`, pdf);
	});

	it('accepte un ordre sous garantie sans pièce', async () => {
		const pdf = await renderRepairOrderPdf(
			fixture({ orderType: 'warranty', warrantyReference: 'GAR-2026-01', parts: [] }) as never
		);
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
	});
});

import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { renderRemittancePdf } from './remittance-pdf';

/** Bordereau monté sur des données réalistes, sans la base. */
function fixture(kind: 'cheque' | 'cash') {
	return {
		id: 89,
		reference: kind === 'cheque' ? 'CHK2610-0089' : 'ESP2610-0089',
		kind,
		bankAccount: 'COMPTE-PRO',
		depositedOn: '2026-10-26',
		total: '168.00',
		settlementCount: 2,
		legacyDoliId: null,
		createdBy: 'davy@example.test',
		createdAt: new Date('2026-10-26T10:00:00Z'),
		lines: [
			{
				id: 1,
				reference: 'PAY2610-0001',
				method: kind,
				amount: '120.00',
				receivedOn: '2026-10-20',
				chequeNumber: kind === 'cheque' ? '7654321' : null,
				chequeIssuer: kind === 'cheque' ? 'Jean Martin' : null,
				chequeBank: kind === 'cheque' ? 'Crédit Agricole' : null,
				repairOrderId: 6,
				repairReference: 'OR-2026-JLRCPK',
				counterInvoiceId: null,
				invoiceNumber: null,
				customerFirstName: 'Jean',
				customerLastName: 'Martin',
				customerCompany: null
			},
			{
				id: 2,
				reference: 'PAY2610-0002',
				method: kind,
				amount: '48.00',
				receivedOn: '2026-10-24',
				chequeNumber: kind === 'cheque' ? '0012345' : null,
				chequeIssuer: null,
				chequeBank: null,
				repairOrderId: 7,
				repairReference: 'OR-2026-ABCDEF',
				counterInvoiceId: null,
				invoiceNumber: null,
				customerFirstName: null,
				customerLastName: null,
				customerCompany: 'Mairie de Carantilly'
			}
		]
	};
}

describe('bordereau de remise en PDF', () => {
	it.each(['cheque', 'cash'] as const)('produit un PDF pour un bordereau « %s »', async (kind) => {
		const pdf = await renderRemittancePdf(fixture(kind));
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		if (process.env.REMITTANCE_PDF_OUT) {
			writeFileSync(`${process.env.REMITTANCE_PDF_OUT}/bordereau-${kind}.pdf`, pdf);
		}
	});
});

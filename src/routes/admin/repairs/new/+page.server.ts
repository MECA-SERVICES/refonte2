import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createRepairOrder, RepairError } from '$lib/server/repairs';
import { EQUIPMENT_TYPES } from '$lib/server/machines';
import { db } from '$lib/server/db';
import { customer } from '$lib/server/db/customer.schema';
import { ilike, or, sql } from 'drizzle-orm';

/** Clients proposés à la sélection, filtrés par la recherche saisie. */
async function searchCustomers(term: string) {
	const cleaned = term.trim();
	if (cleaned.length < 2) return [];

	const like = `%${cleaned}%`;
	return db
		.select({
			id: customer.id,
			firstName: customer.firstName,
			lastName: customer.lastName,
			email: customer.email,
			companyName: customer.companyName
		})
		.from(customer)
		.where(
			or(
				ilike(customer.lastName, like),
				ilike(customer.firstName, like),
				ilike(customer.email, like),
				ilike(customer.companyName, like)
			)
		)
		.orderBy(sql`${customer.lastName} NULLS LAST`)
		.limit(20);
}

export const load: PageServerLoad = async ({ url }) => {
	const term = url.searchParams.get('client') ?? '';
	return {
		customers: await searchCustomers(term),
		customerSearch: term,
		equipmentTypes: EQUIPMENT_TYPES
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const customerId = Number(form.get('customerId'));

		if (!Number.isInteger(customerId) || customerId <= 0) {
			return fail(400, { message: 'Sélectionnez le client propriétaire de la machine.' });
		}

		const num = (key: string) => {
			const raw = form.get(key)?.toString().trim();
			if (!raw) return 0;
			const parsed = Number(raw.replace(',', '.'));
			return Number.isFinite(parsed) ? parsed : 0;
		};
		const str = (key: string) => form.get(key)?.toString() ?? null;

		try {
			const created = await createRepairOrder({
				customerId,
				orderType: form.get('orderType') === 'warranty' ? 'warranty' : 'paid',
				warrantyReference: str('warrantyReference'),
				machineType: str('machineType'),
				machineBrand: str('machineBrand'),
				machineModel: str('machineModel'),
				serialNumber: str('serialNumber'),
				machineCondition: str('machineCondition'),
				engineModel: str('engineModel'),
				engineSerialNumber: str('engineSerialNumber'),
				workDescription: str('workDescription'),
				diagnosticFee: num('diagnosticFee'),
				laborAmount: num('laborAmount'),
				notes: str('notes'),
				privateNote: str('privateNote')
			});

			redirect(303, `/admin/repairs/${created.id}`);
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { message: err.message });
			throw err;
		}
	}
};

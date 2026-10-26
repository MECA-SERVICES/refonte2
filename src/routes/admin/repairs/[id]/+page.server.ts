import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addRepairPart,
	changeRepairStatus,
	getRepairOrder,
	nextStatuses,
	RepairError,
	removeRepairPart,
	setRepairWorkshopLabel,
	updateRepairOrder
} from '$lib/server/repairs';
import { repairStatuses, type RepairStatus } from '$lib/server/db/repair.schema';
import { EQUIPMENT_TYPES } from '$lib/server/machines';
import {
	listRepairSettlements,
	parseSettlementForm,
	recordRepairSettlement,
	SettlementError
} from '$lib/server/settlements';

function idParam(params: { id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Ordre introuvable');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = idParam(params);
	const [order, settlements] = await Promise.all([getRepairOrder(id), listRepairSettlements(id)]);
	if (!order) error(404, 'Ordre introuvable');

	return {
		order,
		settlements,
		transitions: nextStatuses(order.status),
		equipmentTypes: EQUIPMENT_TYPES
	};
};

/** Montant saisi au clavier, virgule décimale admise. */
function amount(form: FormData, key: string): number {
	const raw = form.get(key)?.toString().trim();
	if (!raw) return 0;
	const parsed = Number(raw.replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : 0;
}

export const actions: Actions = {
	/** Met à jour l'en-tête : machine, travaux, montants, notes. */
	update: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();
		const str = (key: string) => form.get(key)?.toString() ?? null;

		try {
			await updateRepairOrder(id, {
				machineType: str('machineType'),
				machineBrand: str('machineBrand'),
				machineModel: str('machineModel'),
				serialNumber: str('serialNumber'),
				machineCondition: str('machineCondition'),
				engineModel: str('engineModel'),
				engineSerialNumber: str('engineSerialNumber'),
				workDescription: str('workDescription'),
				diagnosticFee: amount(form, 'diagnosticFee'),
				laborAmount: amount(form, 'laborAmount'),
				notes: str('notes'),
				privateNote: str('privateNote')
			});
			return { success: true };
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { message: err.message });
			throw err;
		}
	},

	/** Étiquette d'atelier : modifiable quel que soit l'état de l'ordre. */
	setLabel: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();

		try {
			await setRepairWorkshopLabel(id, form.get('workshopLabel')?.toString() ?? null);
			return { labelSaved: true };
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { labelError: err.message });
			throw err;
		}
	},

	/** Ajoute une pièce consommée — du catalogue ou saisie librement. */
	addPart: async ({ request, params, locals }) => {
		const id = idParam(params);
		const form = await request.formData();
		const productRaw = form.get('productId')?.toString().trim();

		try {
			await addRepairPart(
				id,
				{
					productId: productRaw ? Number(productRaw) || null : null,
					partName: form.get('partName')?.toString() ?? null,
					partReference: form.get('partReference')?.toString() ?? null,
					quantity: Number(form.get('quantity')?.toString() ?? '1') || 1,
					unitPriceHt: form.get('unitPriceHt')?.toString().trim()
						? amount(form, 'unitPriceHt')
						: null
				},
				locals.user?.email ?? null
			);
			return { success: true };
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { partError: err.message });
			throw err;
		}
	},

	removePart: async ({ request, params, locals }) => {
		const id = idParam(params);
		const form = await request.formData();
		const partId = Number(form.get('partId')?.toString());
		if (!Number.isInteger(partId)) return fail(400, { partError: 'Ligne introuvable.' });

		try {
			await removeRepairPart(id, partId, locals.user?.email ?? null);
			return { success: true };
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { partError: err.message });
			throw err;
		}
	},

	/** Fait avancer l'ordre dans son cycle de vie. */
	changeStatus: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();
		const to = form.get('status')?.toString() as RepairStatus;

		if (!repairStatuses.includes(to)) {
			return fail(400, { statusError: 'État inconnu.' });
		}

		const expectedRaw = form.get('onHoldExpectedAt')?.toString().trim();

		try {
			await changeRepairStatus(id, to, {
				onHoldPartLabel: form.get('onHoldPartLabel')?.toString() ?? null,
				onHoldExpectedAt: expectedRaw ? new Date(expectedRaw) : null
			});
			return { success: true };
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { statusError: err.message });
			throw err;
		}
	},

	/** Enregistre un règlement : postérieur à l'achèvement, pas une modification. */
	recordPayment: async ({ request, params, locals }) => {
		const id = idParam(params);
		const parsed = parseSettlementForm(await request.formData());
		if (!parsed.ok) return fail(400, { paymentError: parsed.error });

		try {
			await recordRepairSettlement(id, parsed.values, locals.user?.email ?? null);
			return { success: true };
		} catch (err) {
			if (err instanceof SettlementError) return fail(400, { paymentError: err.message });
			throw err;
		}
	}
};

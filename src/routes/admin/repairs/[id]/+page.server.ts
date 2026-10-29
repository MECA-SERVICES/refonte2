import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addRepairPart,
	changeRepairStatus,
	getRepairOrder,
	attachPartSerials,
	nextStatuses,
	RepairError,
	removeRepairPart,
	setRepairWorkshopLabel,
	updateRepairOrder
} from '$lib/server/repairs';
import { repairStatuses, type RepairStatus } from '$lib/server/db/repair.schema';
import { activeEquipmentTypeNames } from '$lib/server/equipment-types';
import { createDraftFromRepair, listRepairCounterInvoices } from '$lib/server/counter-invoices';
import {
	exitDocumentStock,
	getDocumentStock,
	parseDocumentExit,
	StockLocationError,
	type DocumentLine
} from '$lib/server/stock-locations';

/** Pièces du catalogue d'un ordre : ce que le magasinier sort du stock. */
function stockLines(parts: { productId: number | null; quantity: number }[]): DocumentLine[] {
	return parts.flatMap((p) =>
		p.productId ? [{ productId: p.productId, quantity: p.quantity }] : []
	);
}
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
	const [order, settlements, equipmentTypes] = await Promise.all([
		getRepairOrder(id),
		listRepairSettlements(id),
		activeEquipmentTypeNames()
	]);
	if (!order) error(404, 'Ordre introuvable');

	return {
		order,
		partStock: await getDocumentStock(stockLines(order.parts), 'repair', order.reference),
		invoices: await listRepairCounterInvoices(order.id),
		settlements,
		transitions: nextStatuses(order.status),
		equipmentTypes
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
	/** Facture comptoir de l'ordre : pièces, main-d'œuvre et diagnostic repris. */
	invoice: async ({ params, locals }) => {
		const id = await createDraftFromRepair(idParam(params), locals.user?.id ?? null);
		redirect(303, `/admin/invoices/${id}`);
	},

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
	addPart: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();
		const productRaw = form.get('productId')?.toString().trim();

		try {
			await addRepairPart(id, {
				productId: productRaw ? Number(productRaw) || null : null,
				partName: form.get('partName')?.toString() ?? null,
				partReference: form.get('partReference')?.toString() ?? null,
				quantity: Number(form.get('quantity')?.toString() ?? '1') || 1,
				unitPriceHt: form.get('unitPriceHt')?.toString().trim() ? amount(form, 'unitPriceHt') : null
			});
			return { success: true };
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { partError: err.message });
			throw err;
		}
	},

	/** Sortie manuelle du stock d'une pièce de l'ordre, par le magasinier. */
	stockExit: async ({ request, params, locals }) => {
		const order = await getRepairOrder(idParam(params));
		if (!order) return fail(404, { partError: 'Ordre introuvable.' });
		const exit = parseDocumentExit(await request.formData());
		try {
			await exitDocumentStock({
				lines: stockLines(order.parts),
				type: 'repair',
				reference: order.reference,
				...exit,
				createdBy: locals.user?.id ?? null
			});
		} catch (err) {
			if (err instanceof StockLocationError) return fail(400, { partError: err.message });
			throw err;
		}
		// Les numéros sortis restent attachés à la pièce posée sur cette machine.
		await attachPartSerials(order.id, exit.productId, exit.serials);
		return { success: true };
	},

	removePart: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();
		const partId = Number(form.get('partId')?.toString());
		if (!Number.isInteger(partId)) return fail(400, { partError: 'Ligne introuvable.' });

		try {
			await removeRepairPart(id, partId);
			return { success: true };
		} catch (err) {
			if (err instanceof RepairError) return fail(400, { partError: err.message });
			throw err;
		}
	},

	/** Fait avancer l'ordre dans son cycle de vie. */
	changeStatus: async ({ request, params, locals }) => {
		const id = idParam(params);
		const form = await request.formData();
		const to = form.get('status')?.toString() as RepairStatus;

		if (!repairStatuses.includes(to)) {
			return fail(400, { statusError: 'État inconnu.' });
		}

		const expectedRaw = form.get('onHoldExpectedAt')?.toString().trim();

		try {
			await changeRepairStatus(
				id,
				to,
				{
					onHoldPartLabel: form.get('onHoldPartLabel')?.toString() ?? null,
					onHoldExpectedAt: expectedRaw ? new Date(expectedRaw) : null
				},
				locals.user?.email ?? null
			);
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

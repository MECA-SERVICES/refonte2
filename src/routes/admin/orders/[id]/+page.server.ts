import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getOrderFull, listOrderStates, changeOrderState } from '$lib/server/orders';
import { shipOrder, FulfillmentError } from '$lib/server/fulfillment';
import { fetchLabelPdf, isSendcloudConfigured, TEST_SHIPPING_OPTION_CODE } from '$lib/server/sendcloud';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Commande introuvable');

	const [order, states] = await Promise.all([getOrderFull(id), listOrderStates()]);
	if (!order) throw error(404, 'Commande introuvable');

	return {
		order,
		states: states.map((s) => ({ id: s.id, label: s.label, color: s.color })),
		sendcloudReady: isSendcloudConfigured(),
		/** Offre de test Sendcloud : crée une étiquette réelle sans facturation. */
		testOptionCode: TEST_SHIPPING_OPTION_CODE
	};
};

export const actions: Actions = {
	changeState: async ({ request, params, locals }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'Commande introuvable');

		const form = await request.formData();
		const stateId = Number(form.get('stateId'));
		if (!Number.isInteger(stateId)) return fail(400, { message: 'État invalide.' });

		await changeOrderState({
			orderId: id,
			stateId,
			changedBy: locals.user?.id ?? null,
			note: form.get('note')?.toString().trim() || null
		});
		return { success: true };
	},

	/** Crée le colis chez Sendcloud et enregistre le suivi (R12, R13). */
	ship: async ({ request, params }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'Commande introuvable');

		const form = await request.formData();
		const weightKg = Number(form.get('weightKg'));
		if (!Number.isFinite(weightKg) || weightKg <= 0) {
			return fail(400, { message: 'Renseignez un poids valide.' });
		}

		const length = Number(form.get('lengthCm'));
		const width = Number(form.get('widthCm'));
		const height = Number(form.get('heightCm'));
		// Sendcloud exige les trois dimensions ou aucune.
		const dimensionsCm =
			length > 0 && width > 0 && height > 0 ? { length, width, height } : undefined;

		try {
			const shipment = await shipOrder({
				orderId: id,
				weightKg,
				dimensionsCm,
				overrideOptionCode: form.get('optionCode')?.toString() || undefined
			});
			return { shipped: true, trackingNumber: shipment.trackingNumber };
		} catch (cause) {
			if (cause instanceof FulfillmentError) return fail(400, { message: cause.message });
			console.error('[admin] expédition impossible', { orderId: id, cause });
			return fail(502, { message: 'Sendcloud a refusé la création du colis.' });
		}
	},

	/**
	 * Sert l'étiquette PDF.
	 *
	 * Le lien Sendcloud exige la même authentification que l'API : il ne peut
	 * pas être ouvert directement par le navigateur de l'opérateur.
	 */
	label: async ({ params }) => {
		const id = Number(params.id);
		const order = await getOrderFull(id);
		if (!order?.sendcloudParcelId) return fail(404, { message: 'Aucune étiquette disponible.' });

		try {
			const pdf = await fetchLabelPdf(order.sendcloudParcelId);
			return { labelBase64: Buffer.from(pdf).toString('base64') };
		} catch {
			return fail(502, { message: 'Étiquette indisponible.' });
		}
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createRemittance,
	listPendingSettlements,
	parseRemittanceForm,
	SettlementError
} from '$lib/server/settlements';
import { isRemittanceKind } from '$lib/settlements';

export const load: PageServerLoad = async ({ url }) => {
	const param = url.searchParams.get('type');
	const kind = isRemittanceKind(param) ? param : 'cheque';
	return { kind, settlements: await listPendingSettlements(kind) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const parsed = parseRemittanceForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		let id: number;
		try {
			({ id } = await createRemittance(parsed.values, locals.user?.email ?? null));
		} catch (err) {
			if (err instanceof SettlementError) return fail(400, { message: err.message });
			throw err;
		}
		redirect(303, `/admin/remittances/${id}`);
	}
};

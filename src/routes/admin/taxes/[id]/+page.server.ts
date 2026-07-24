import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getTaxRule, updateTaxRule, deleteTaxRule, parseTaxRuleForm } from '$lib/server/catalog';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Taux introuvable');

	const taxRule = await getTaxRule(id);
	if (!taxRule) throw error(404, 'Taux introuvable');

	return { taxRule };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = Number(params.id);
		if (!Number.isInteger(id)) throw error(404, 'Taux introuvable');

		const parsed = parseTaxRuleForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		await updateTaxRule(id, parsed.values);
		throw redirect(303, '/admin/taxes');
	},

	delete: async ({ params }) => {
		const id = Number(params.id);
		if (Number.isInteger(id)) await deleteTaxRule(id);
		throw redirect(303, '/admin/taxes');
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createTaxRule, parseTaxRuleForm } from '$lib/server/catalog';

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseTaxRuleForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });

		await createTaxRule(parsed.values);
		throw redirect(303, '/admin/taxes');
	}
};

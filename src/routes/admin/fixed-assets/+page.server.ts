import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createFixedAsset,
	deleteFixedAsset,
	listFixedAssets,
	parseFixedAssetForm,
	updateFixedAsset
} from '$lib/server/fixed-assets';
import { fixedAssetUsages } from '$lib/server/db/fixed-asset.schema';

export const load: PageServerLoad = async () => ({
	...(await listFixedAssets()),
	usageOptions: fixedAssetUsages
});

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseFixedAssetForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		await createFixedAsset(parsed.values);
		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const parsed = parseFixedAssetForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.error });
		await updateFixedAsset(Number(form.get('id')), parsed.values);
		return { success: true };
	},

	delete: async ({ request }) => {
		await deleteFixedAsset(Number((await request.formData()).get('id')));
		return { success: true };
	}
};

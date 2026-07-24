import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getProductFull,
	updateProduct,
	deleteProduct,
	parseProductForm,
	activeBrands,
	allCategories,
	activeTaxRules,
	addVariant,
	deleteVariant,
	addMedia,
	deleteMedia,
	recordStockMovement
} from '$lib/server/catalog';
import type { StockMovementType } from '$lib/server/db/catalog.schema';

function idParam(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Produit introuvable');
	return id;
}

const MOVEMENT_TYPES: StockMovementType[] = ['in', 'out', 'adjustment', 'order', 'return'];

export const load: PageServerLoad = async ({ params }) => {
	const id = idParam(params);
	const [product, brands, cats, taxes] = await Promise.all([
		getProductFull(id),
		activeBrands(),
		allCategories(),
		activeTaxRules()
	]);
	if (!product) throw error(404, 'Produit introuvable');

	return {
		product,
		brandOptions: brands.map((b) => ({ value: String(b.id), name: b.name })),
		categoryOptions: cats.map((c) => ({ value: String(c.id), name: c.name })),
		taxOptions: taxes.map((t) => ({
			value: String(t.id),
			name: `${t.name} (${Number(t.rate)} %)`,
			rate: Number(t.rate)
		}))
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = idParam(params);
		const parsed = parseProductForm(await request.formData());
		if ('error' in parsed) return fail(400, { message: parsed.error });

		// Le stock n'est pas modifiable ici : il est piloté par les mouvements de stock.
		const { stock: _ignoredStock, ...values } = parsed.values;
		await updateProduct(id, { ...values, priceUpdatedAt: new Date() });
		return { success: true };
	},

	stockMovement: async ({ request, params, locals }) => {
		const id = idParam(params);
		const form = await request.formData();
		const type = form.get('type')?.toString() as StockMovementType;
		const quantity = Number(form.get('quantity')?.toString());

		if (!MOVEMENT_TYPES.includes(type) || !Number.isInteger(quantity) || quantity === 0) {
			return fail(400, { stockError: 'Type et quantité (non nulle) requis.' });
		}

		// Les sorties/commandes retirent du stock : quantité rendue négative.
		const delta = type === 'out' || type === 'order' ? -Math.abs(quantity) : quantity;

		await recordStockMovement({
			productId: id,
			quantity: delta,
			type,
			note: form.get('note')?.toString().trim() || null,
			createdBy: locals.user?.id ?? null
		});
		return { success: true };
	},

	delete: async ({ params }) => {
		await deleteProduct(idParam(params));
		throw redirect(303, '/admin/products');
	},

	addVariant: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();
		const name = form.get('name')?.toString().trim();
		if (!name) return fail(400, { variantError: 'Le nom de la variante est requis.' });

		// Attributs saisis en "clé=valeur" par ligne, ex. "Pointure=39".
		const attributes: Record<string, string> = {};
		for (const line of (form.get('attributes')?.toString() ?? '').split('\n')) {
			const [k, ...rest] = line.split('=');
			if (k?.trim() && rest.length) attributes[k.trim()] = rest.join('=').trim();
		}

		await addVariant({
			productId: id,
			name,
			attributes: Object.keys(attributes).length ? attributes : null,
			reference: form.get('reference')?.toString().trim() || null,
			ean13: form.get('ean13')?.toString().trim() || null,
			priceImpact: form.get('priceImpact')?.toString().trim() || '0',
			stock: Number(form.get('stock')?.toString() ?? '0') || 0,
			isDefault: form.get('isDefault') != null
		});
		return { success: true };
	},

	deleteVariant: async ({ request }) => {
		const form = await request.formData();
		const vid = Number(form.get('variantId')?.toString());
		if (Number.isInteger(vid)) await deleteVariant(vid);
		return { success: true };
	},

	addMedia: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();
		const url = form.get('url')?.toString().trim();
		if (!url) return fail(400, { mediaError: "L'URL du média est requise." });

		await addMedia({
			productId: id,
			type: form.get('type')?.toString() || 'image',
			url,
			alt: form.get('alt')?.toString().trim() || null,
			position: Number(form.get('position')?.toString() ?? '0') || 0
		});
		return { success: true };
	},

	deleteMedia: async ({ request }) => {
		const form = await request.formData();
		const mid = Number(form.get('mediaId')?.toString());
		if (Number.isInteger(mid)) await deleteMedia(mid);
		return { success: true };
	}
};

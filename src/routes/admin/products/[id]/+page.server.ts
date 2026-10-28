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
	setProductCategories,
	addProductRelation,
	removeProductRelation
} from '$lib/server/catalog';
import type { StockMovementType } from '$lib/server/db/catalog.schema';
import {
	listProductPlacements,
	listStockLocations,
	productsOnSaleFloor,
	recordStockMovement,
	StockLocationError
} from '$lib/server/stock-locations';

function idParam(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Produit introuvable');
	return id;
}

/** Mouvements saisis depuis la fiche ; les sorties de commande et d'ordre se font depuis ceux-ci. */
const MOVEMENT_TYPES: StockMovementType[] = ['in', 'out', 'adjustment', 'return'];

export const load: PageServerLoad = async ({ params }) => {
	const id = idParam(params);
	const [product, brands, cats, taxes, placements, locations, onSale] = await Promise.all([
		getProductFull(id),
		activeBrands(),
		allCategories(),
		activeTaxRules(),
		listProductPlacements(id),
		listStockLocations(),
		productsOnSaleFloor([id])
	]);
	if (!product) throw error(404, 'Produit introuvable');

	return {
		product,
		placements,
		locations,
		/** Rangé au magasin : son étiquette porte le prix TTC. */
		onSaleFloor: onSale.has(id),
		brandOptions: brands.map((b) => ({ value: String(b.id), name: b.name })),
		categoryTree: cats,
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
		const form = await request.formData();
		const parsed = parseProductForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.error });

		// Le stock n'est pas dans le formulaire : il est piloté par les mouvements de stock.
		const values = parsed.values;
		await updateProduct(id, { ...values, priceUpdatedAt: new Date() });

		// Catégories additionnelles : cases à cocher, donc absentes du FormData
		// lorsqu'elles sont toutes décochées — le tableau vide vide bien la table.
		const extraCategoryIds = form
			.getAll('categoryIds')
			.map((v) => Number(v.toString()))
			.filter(Number.isInteger);
		await setProductCategories(id, extraCategoryIds, values.categoryId);

		return { success: true };
	},

	stockMovement: async ({ request, params, locals }) => {
		const id = idParam(params);
		const form = await request.formData();
		const type = form.get('type')?.toString() as StockMovementType;
		const quantity = Number(form.get('quantity')?.toString());

		const locationId = Number(form.get('locationId'));

		if (!MOVEMENT_TYPES.includes(type) || !Number.isInteger(quantity) || quantity === 0) {
			return fail(400, { stockError: 'Type et quantité (non nulle) requis.' });
		}
		if (!Number.isInteger(locationId) || locationId <= 0) {
			return fail(400, { stockError: "Choisissez l'emplacement concerné." });
		}

		// Une sortie retire du stock : quantité rendue négative. Un ajustement
		// garde son signe (+ ou −), une entrée et un retour ajoutent.
		const delta =
			type === 'out' ? -Math.abs(quantity) : type === 'adjustment' ? quantity : Math.abs(quantity);

		try {
			await recordStockMovement({
				productId: id,
				locationId,
				quantity: delta,
				type,
				reference: form.get('reference')?.toString().trim() || null,
				note: form.get('note')?.toString().trim() || null,
				createdBy: locals.user?.id ?? null
			});
		} catch (err) {
			if (err instanceof StockLocationError) return fail(400, { stockError: err.message });
			throw err;
		}
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

	addRelation: async ({ request, params }) => {
		const id = idParam(params);
		const form = await request.formData();
		const reference = form.get('reference')?.toString().trim();
		if (!reference) return fail(400, { relationError: 'La référence est requise.' });

		const result = await addProductRelation(id, reference);
		if ('error' in result) return fail(400, { relationError: result.error });
		return { success: true };
	},

	removeRelation: async ({ request }) => {
		const form = await request.formData();
		const rid = Number(form.get('relationId')?.toString());
		if (Number.isInteger(rid)) await removeProductRelation(rid);
		return { success: true };
	},

	deleteMedia: async ({ request }) => {
		const form = await request.formData();
		const mid = Number(form.get('mediaId')?.toString());
		if (Number.isInteger(mid)) await deleteMedia(mid);
		return { success: true };
	}
};

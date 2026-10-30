/**
 * Registre des immobilisations (module UTILE de Dolibarr) : saisie à la main,
 * ou créées par une sortie de stock « Investissement », une par pièce, comme
 * UTILE le faisait.
 */
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { product } from '$lib/server/db/catalog.schema';
import { fixedAsset } from '$lib/server/db/fixed-asset.schema';
import { formFields, type ParseResult } from '$lib/server/forms';

/** Immobilisations en service d'abord, les plus récentes en tête ; total par usage. */
export async function listFixedAssets() {
	const rows = await db
		.select({ asset: fixedAsset, productReference: product.reference })
		.from(fixedAsset)
		.leftJoin(product, eq(product.id, fixedAsset.productId))
		.orderBy(
			desc(fixedAsset.isActive),
			sql`${fixedAsset.acquiredOn} DESC NULLS LAST`,
			desc(fixedAsset.id)
		);
	const assets = rows.map((r) => ({ ...r.asset, productReference: r.productReference }));
	const byUsage = new Map<string, { count: number; total: number }>();
	for (const a of assets.filter((a) => a.isActive)) {
		const key = a.usage ?? 'Sans usage';
		const row = byUsage.get(key) ?? { count: 0, total: 0 };
		row.count++;
		row.total += Number(a.purchasePrice ?? 0);
		byUsage.set(key, row);
	}
	return {
		assets,
		usages: [...byUsage.entries()]
			.map(([usage, v]) => ({ usage, ...v }))
			.sort((a, b) => a.usage.localeCompare(b.usage))
	};
}

export type FixedAssetInput = {
	name: string;
	description: string | null;
	usage: string | null;
	acquiredOn: string | null;
	purchasePrice: string | null;
	bookValue: string | null;
	isActive: boolean;
};

export function parseFixedAssetForm(form: FormData): ParseResult<FixedAssetInput> {
	const { str, num, bool } = formFields(form);
	const name = str('name');
	if (!name) return { ok: false, error: 'Indiquez le nom de l’immobilisation.' };
	const purchasePrice = num('purchasePrice');
	const bookValue = num('bookValue');
	if ([purchasePrice, bookValue].some((v) => v !== null && Number(v) < 0)) {
		return { ok: false, error: 'Un montant ne peut pas être négatif.' };
	}
	return {
		ok: true,
		values: {
			name,
			description: form.get('description')?.toString().trim() || null,
			usage: str('usage'),
			acquiredOn: str('acquiredOn'),
			purchasePrice,
			bookValue,
			isActive: bool('isActive')
		}
	};
}

export async function createFixedAsset(input: FixedAssetInput) {
	await db.insert(fixedAsset).values(input);
}

export async function updateFixedAsset(id: number, input: FixedAssetInput) {
	await db
		.update(fixedAsset)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(fixedAsset.id, id));
}

export async function deleteFixedAsset(id: number) {
	await db.delete(fixedAsset).where(eq(fixedAsset.id, id));
}

/**
 * Sortie « Investissement » : chaque pièce sortie devient une immobilisation,
 * à son prix d'achat, avec son n° de série.
 */
export async function assetsFromInvestment(
	lines: { productId: number; quantity: number; serials: string[] }[],
	acquiredOn: string
) {
	if (!lines.length) return;
	const products = await db
		.select({
			id: product.id,
			name: product.name,
			reference: product.reference,
			purchasePrice: product.purchasePrice
		})
		.from(product)
		.where(
			inArray(
				product.id,
				lines.map((l) => l.productId)
			)
		)
		.orderBy(asc(product.id));
	const byId = new Map(products.map((p) => [p.id, p]));
	const values = lines.flatMap((l) => {
		const p = byId.get(l.productId);
		if (!p) return [];
		return Array.from({ length: l.quantity }, (_, i) => ({
			name: p.reference,
			description: [p.name, l.serials[i] ? `N° de série : ${l.serials[i]}` : null]
				.filter(Boolean)
				.join('\n'),
			acquiredOn,
			purchasePrice: p.purchasePrice,
			productId: p.id
		}));
	});
	if (values.length) await db.insert(fixedAsset).values(values);
}

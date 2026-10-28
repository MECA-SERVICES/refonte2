/**
 * État du stock dans le module Dolibarr « UTILE » : `type` 1 = neuf,
 * 2 = occasion, 3 = garantie (`utile_type_stock`, `utile_type_inv`, bons).
 * Une ligne de stock (produit × emplacement) se répartit entre ces états.
 */

export type Condition = 'new' | 'used' | 'warranty';

/** État MSShop d'un type UTILE ; un type inconnu compte comme neuf. */
export function conditionOf(type: number | null): Condition {
	return type === 2 ? 'used' : type === 3 ? 'warranty' : 'new';
}

/**
 * Répartit la quantité d'une ligne de stock entre ses états. La quantité de la
 * ligne fait foi : un reste non typé compte comme neuf, un excédent typé est
 * retiré du neuf d'abord. Les états à 0 ne sont pas rendus.
 */
export function splitByCondition(
	quantity: number,
	types: { type: number | null; quantity: number }[]
): { condition: Condition; quantity: number }[] {
	const split: Record<Condition, number> = { new: 0, used: 0, warranty: 0 };
	for (const t of types) split[conditionOf(t.type)] += Math.max(0, Math.round(t.quantity));
	let gap = Math.round(quantity) - (split.new + split.used + split.warranty);
	if (gap > 0) split.new += gap;
	for (const c of ['new', 'used', 'warranty'] as const) {
		if (gap >= 0) break;
		const take = Math.min(split[c], -gap);
		split[c] -= take;
		gap += take;
	}
	return (['new', 'used', 'warranty'] as const)
		.filter((c) => split[c] !== 0)
		.map((c) => ({ condition: c, quantity: split[c] }));
}

/**
 * Répartit les numéros de série d'une ligne de stock entre ses états, dans
 * l'ordre neuf, occasion, garantie, sans dépasser la quantité de chaque état :
 * Dolibarr ne dit pas quel numéro va avec quel état. Les numéros en trop
 * (pièce sortie dont Dolibarr a gardé le numéro) restent sans état : `null`.
 */
export function assignSerials(
	serials: string[],
	stock: { condition: Condition; quantity: number }[]
): { serial: string; condition: Condition | null }[] {
	const slots = (['new', 'used', 'warranty'] as const).flatMap((c) =>
		Array.from(
			{ length: Math.max(0, stock.find((s) => s.condition === c)?.quantity ?? 0) },
			() => c
		)
	);
	return serials.map((serial, i) => ({ serial, condition: slots[i] ?? null }));
}

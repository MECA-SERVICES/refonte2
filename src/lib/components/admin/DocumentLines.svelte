<script lang="ts" module>
	/** Ligne d'une facture comptoir ou d'un devis, telle que l'affiche l'éditeur. */
	export type EditableLine = {
		id: number;
		productId: number | null;
		productType: string | null;
		label: string;
		reference: string | null;
		quantity: string;
		unitPriceHt: string;
		taxRate: string;
		discountPercent: string;
		totalTtc: string;
	};

	/** Produit ou prestation proposé par la recherche (`searchBillableProducts`). */
	export type BillableProduct = {
		id: number;
		name: string;
		reference: string;
		type: string;
		stock: number;
		priceHt: string;
		taxRate: string;
	};
</script>

<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import type { Pathname } from '$app/types';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button, Card, Input, Label, Select } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { formatPrice, round2 } from '$lib/money';
	import StateBadge from './StateBadge.svelte';

	/**
	 * Lignes d'une facture comptoir ou d'un devis. Brouillon : chaque ligne se
	 * modifie sur place (désignation, quantité, prix TTC, remise, TVA), et on
	 * ajoute un produit, une prestation (`MO-T1`…) ou une ligne libre. Sinon,
	 * lecture seule, avec `lineExtra` sous chaque ligne (stock à sortir…).
	 *
	 * La page porte les actions `?/updateLine`, `?/deleteLine`, `?/addProduct`
	 * et `?/addFree` ; la recherche de produits passe par `?q=` sur `basePath`.
	 */

	let {
		lines,
		editable,
		basePath,
		q,
		products,
		lineExtra
	}: {
		lines: EditableLine[];
		editable: boolean;
		basePath: Pathname;
		q: string;
		products: BillableProduct[];
		lineExtra?: Snippet<[EditableLine]>;
	} = $props();

	const TAX_RATES = [20, 10, 5.5, 0].map((r) => ({ value: String(r), name: `${r} %` }));

	/** Prix unitaire TTC d'une ligne, celui qu'on saisit au comptoir. */
	const unitTtc = (l: { unitPriceHt: string; taxRate: string }) =>
		round2(Number(l.unitPriceHt) * (1 + Number(l.taxRate) / 100));

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function search(value: string) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			const term = value.trim();
			goto((term ? `${basePath}?q=${encodeURIComponent(term)}` : basePath) as Pathname, {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}, 300);
	}

	const keepValues: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });
	const clearSearch: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				await goto(basePath, { keepFocus: true, noScroll: true, replaceState: true });
			}
		};
</script>

<Card class="max-w-none p-5">
	<h2 class="mb-4 text-lg font-semibold text-gray-900">Lignes</h2>
	{#if lines.length === 0}
		<p class="py-6 text-center text-sm text-gray-500">
			Aucune ligne : ajoutez un produit, une prestation ou une ligne libre ci-dessous.
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
					<tr>
						<th scope="col" class="py-2 pe-3 text-start">Désignation</th>
						<th scope="col" class="px-2 py-2 text-end">Qté</th>
						<th scope="col" class="px-2 py-2 text-end">P.U. TTC</th>
						<th scope="col" class="px-2 py-2 text-end">Remise</th>
						<th scope="col" class="px-2 py-2 text-end">TVA</th>
						<th scope="col" class="px-2 py-2 text-end">Total TTC</th>
						{#if editable}<th scope="col" class="py-2 ps-2"><span class="sr-only">Actions</span></th
							>{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each lines as line (line.id)}
						{#if editable}
							<tr class="align-top">
								<td class="py-2 pe-3" colspan="7">
									<form
										method="POST"
										action="?/updateLine"
										use:enhance={keepValues}
										data-success="Ligne enregistrée."
										class="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6.5rem_4.5rem_5.5rem_6rem_auto]"
									>
										<input type="hidden" name="lineId" value={line.id} />
										<div class="min-w-0">
											<Input name="label" value={line.label} size="sm" aria-label="Désignation" />
											<p class="mt-0.5 text-xs text-gray-500">
												{line.reference ?? 'Ligne libre'}{line.productType === 'service'
													? ' · prestation'
													: ''}
											</p>
										</div>
										<Input
											name="quantity"
											value={String(Number(line.quantity))}
											size="sm"
											class="text-end"
											aria-label="Quantité"
										/>
										<Input
											name="priceTtc"
											value={unitTtc(line).toFixed(2)}
											size="sm"
											class="text-end"
											aria-label="Prix unitaire TTC"
										/>
										<Input
											name="discountPercent"
											value={String(Number(line.discountPercent))}
											size="sm"
											class="text-end"
											aria-label="Remise en %"
										/>
										<Select
											name="taxRate"
											items={TAX_RATES}
											value={String(Number(line.taxRate))}
											size="sm"
											placeholder=""
											aria-label="Taux de TVA"
										/>
										<p class="pt-2 text-end font-semibold tabular-nums">
											{formatPrice(line.totalTtc)}
										</p>
										<div class="flex gap-1">
											<Button type="submit" size="xs" color="alternative">OK</Button>
											<button
												type="submit"
												formaction="?/deleteLine"
												aria-label="Supprimer la ligne {line.label}"
												class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-700"
											>
												<TrashBinOutline class="h-4 w-4" />
											</button>
										</div>
									</form>
								</td>
							</tr>
						{:else}
							<tr class="align-top">
								<td class="py-2 pe-3">
									<p class="font-medium text-gray-900">
										{#if line.productId}<a
												href="/admin/products/{line.productId}"
												class="hover:underline">{line.label}</a
											>{:else}{line.label}{/if}
									</p>
									<p class="text-xs text-gray-500">
										{line.reference ?? 'Ligne libre'}{line.productType === 'service'
											? ' · prestation'
											: ''}
									</p>
									{@render lineExtra?.(line)}
								</td>
								<td class="px-2 py-2 text-end tabular-nums">{Number(line.quantity)}</td>
								<td class="px-2 py-2 text-end tabular-nums">{formatPrice(unitTtc(line))}</td>
								<td class="px-2 py-2 text-end tabular-nums"
									>{Number(line.discountPercent) ? `${Number(line.discountPercent)} %` : ''}</td
								>
								<td class="px-2 py-2 text-end tabular-nums">{Number(line.taxRate)} %</td>
								<td class="px-2 py-2 text-end font-semibold tabular-nums"
									>{formatPrice(line.totalTtc)}</td
								>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</Card>

{#if editable}
	<Card class="max-w-none p-5">
		<label for="line-search" class="mb-2 block text-sm font-semibold text-gray-900">
			Ajouter un produit ou une prestation (MO-T1, révision…)
		</label>
		<input
			id="line-search"
			type="search"
			value={q}
			oninput={(e) => search(e.currentTarget.value)}
			autocomplete="off"
			placeholder="Référence, nom ou EAN : « MO-T1 », « courroie mtd »"
			class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
		/>
		{#if q}
			<ul class="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
				{#each products as p (p.id)}
					<li class="flex items-center gap-3 p-2 text-sm">
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium text-gray-900">{p.name}</p>
							<p class="text-xs text-gray-500">
								{p.reference} · {formatPrice(
									round2(Number(p.priceHt) * (1 + Number(p.taxRate) / 100))
								)} TTC
								{p.type === 'service' ? '· prestation' : `· stock ${p.stock}`}
							</p>
						</div>
						{#if p.type === 'service'}<StateBadge color="blue" label="Prestation" />{/if}
						<form
							method="POST"
							action="?/addProduct"
							use:enhance={clearSearch}
							data-success="Ligne ajoutée."
						>
							<input type="hidden" name="productId" value={p.id} />
							<Button type="submit" size="xs">Ajouter</Button>
						</form>
					</li>
				{:else}
					<li class="p-3 text-sm text-gray-500">Rien ne correspond : ajoutez une ligne libre.</li>
				{/each}
			</ul>
		{/if}

		<form
			method="POST"
			action="?/addFree"
			use:enhance
			data-success="Ligne ajoutée."
			class="mt-5 grid gap-2 border-t border-gray-200 pt-4 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_auto] sm:items-end"
		>
			<div>
				<Label for="free-label" class="mb-1 text-xs">Ligne libre : désignation</Label>
				<Input
					id="free-label"
					name="label"
					size="sm"
					placeholder="ex. Roue arrière réf. 122E87-3"
					required
				/>
			</div>
			<div>
				<Label for="free-qty" class="mb-1 text-xs">Qté</Label>
				<Input id="free-qty" name="quantity" value="1" size="sm" />
			</div>
			<div>
				<Label for="free-price" class="mb-1 text-xs">P.U. TTC</Label>
				<Input id="free-price" name="priceTtc" size="sm" required />
			</div>
			<div>
				<Label for="free-tax" class="mb-1 text-xs">TVA</Label>
				<Select
					id="free-tax"
					name="taxRate"
					items={TAX_RATES}
					value="20"
					size="sm"
					placeholder=""
				/>
			</div>
			<Button type="submit" size="sm" color="alternative">Ajouter</Button>
		</form>
	</Card>
{/if}

<script lang="ts">
	/**
	 * Produits rangés, une ligne par emplacement, à cocher pour les déplacer.
	 *
	 * La sélection vient de la page et survit à la navigation : on peut cocher
	 * des produits sur plusieurs étagères ou depuis la recherche, puis tout
	 * déplacer d'un coup. Une ligne cochée reste surlignée pour qu'on voie ce
	 * qu'on s'apprête à ranger.
	 */
	import { Button, Checkbox } from 'flowbite-svelte';
	import { ArrowRightAltOutline, PrinterOutline } from 'flowbite-svelte-icons';
	import { DOLIBARR_STOCK_COLORS as COLORS } from '$lib/admin-colors';
	import { isValidEan13, printableEan13 } from '$lib/ean13';
	import type { SvelteMap } from 'svelte/reactivity';
	import { formatNumber } from '$lib/money';
	import { placementKey, type StoredRow } from '$lib/stock-locations';
	import StateBadge from './StateBadge.svelte';
	import Thumbnail from './Thumbnail.svelte';

	let {
		rows,
		selection,
		locationLabel,
		relativeTo,
		onmove
	}: {
		rows: StoredRow[];
		/** Lignes cochées, par `placementKey`. */
		selection: SvelteMap<string, StoredRow>;
		/** Libellé d'un emplacement : chemin lisible et code d'étiquette. */
		locationLabel: (locationId: number) => {
			path: string;
			code: string | null;
			description: string | null;
		};
		/** Chemin de l'emplacement ouvert : les chemins s'affichent à partir de lui. */
		relativeTo?: string;
		/** Déplacer cette seule ligne. */
		onmove: (row: StoredRow) => void;
	} = $props();

	const allChecked = $derived(rows.length > 0 && rows.every((r) => selection.has(placementKey(r))));
	const someChecked = $derived(!allChecked && rows.some((r) => selection.has(placementKey(r))));

	function toggle(row: StoredRow, checked: boolean) {
		if (checked) selection.set(placementKey(row), row);
		else selection.delete(placementKey(row));
	}

	function toggleAll(checked: boolean) {
		for (const row of rows) toggle(row, checked);
	}

	/** « RANGEE 7 › BOITE 2 » plutôt que le chemin complet, dans l'emplacement ouvert. */
	function shortPath(path: string) {
		if (!relativeTo) return path;
		if (path === relativeTo) return 'Ici';
		return path.startsWith(`${relativeTo} › `) ? path.slice(relativeTo.length + 3) : path;
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
			<tr>
				<th scope="col" class="w-10 py-2 ps-2">
					<Checkbox
						checked={allChecked}
						indeterminate={someChecked}
						onchange={(e) => toggleAll(e.currentTarget.checked)}
						aria-label="Tout sélectionner ({rows.length} lignes)"
					/>
				</th>
				<th scope="col" class="py-2 pe-3 text-start">Produit</th>
				<th scope="col" class="px-3 py-2 text-start">Rangé dans</th>
				<th scope="col" class="px-3 py-2 text-end">Qté</th>
				<th scope="col" class="px-3 py-2 text-end">Stock total</th>
				<th scope="col" class="px-3 py-2 text-start">Aussi rangé dans</th>
				<th scope="col" class="py-2 ps-3"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each rows as row (placementKey(row))}
				{@const checked = selection.has(placementKey(row))}
				{@const here = locationLabel(row.locationId)}
				<tr class="align-top {checked ? 'bg-primary-100' : 'hover:bg-gray-50'}">
					<td class="py-3 ps-2">
						<Checkbox
							{checked}
							onchange={(e) => toggle(row, e.currentTarget.checked)}
							aria-label="Sélectionner {row.name} ({here.path})"
						/>
					</td>
					<td class="min-w-64 py-2 pe-3">
						<div class="flex items-start gap-3">
							<Thumbnail src={row.imageUrl} alt={row.name} />
							<div class="min-w-0">
								<a
									href="/admin/products/{row.productId}"
									class="font-medium text-gray-900 hover:text-primary-700 hover:underline"
								>
									{row.name}
								</a>
								<p class="text-xs text-gray-500">
									Réf. {row.reference}{row.brandName ? ` · ${row.brandName}` : ''}
									{#if row.ean13}
										· EAN
										<!-- Rouge comme dans UTILE : chiffre de contrôle faux. -->
										<span
											style:background-color={isValidEan13(row.ean13) ? undefined : COLORS.alert}
											title={isValidEan13(row.ean13)
												? undefined
												: `EAN-13 invalide : l'étiquette imprimera ${printableEan13(row.ean13)}.`}
											class={isValidEan13(row.ean13)
												? ''
												: 'cursor-help rounded px-1 text-gray-900'}>{row.ean13}</span
										>
									{/if}
								</p>
								{#if !row.isActive}
									<StateBadge color="gray" label="Hors boutique" class="mt-1" />
								{/if}
							</div>
						</div>
					</td>
					<td class="px-3 py-2">
						<a
							href="?id={row.locationId}"
							class="text-gray-800 hover:text-primary-700 hover:underline"
						>
							{shortPath(here.path)}
						</a>
						{#if here.code}
							<span
								title={here.description ?? here.path}
								class="ms-1 cursor-help rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700"
							>
								{here.code}
							</span>
						{/if}
					</td>
					<!-- Couleurs Dolibarr : vert = en stock, rouge clair = vide. -->
					<td
						class="px-3 py-2 text-end text-base font-semibold text-gray-900 tabular-nums"
						style:background-color={row.quantity > 0 ? COLORS.inStock : COLORS.outOfStock}
					>
						{formatNumber(row.quantity)}
					</td>
					<td class="px-3 py-2 text-end tabular-nums" title="Somme de tous les emplacements">
						{formatNumber(row.shopStock)}
					</td>
					<td class="px-3 py-2">
						{#each row.placements.filter((p) => p.locationId !== row.locationId) as p (p.locationId)}
							{@const other = locationLabel(p.locationId)}
							<a
								href="?id={p.locationId}"
								title={other.description ?? other.path}
								class="me-1 mb-1 inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:border-primary-500 hover:text-primary-800"
							>
								{other.code ?? other.path}
								<span class="font-semibold">×{p.quantity}</span>
							</a>
						{:else}
							<span class="text-xs text-gray-400">—</span>
						{/each}
					</td>
					<td class="py-2 ps-3 text-end">
						<div class="flex justify-end gap-1.5">
							<Button size="xs" color="alternative" onclick={() => onmove(row)}>
								<ArrowRightAltOutline class="me-1 h-3.5 w-3.5" /> Déplacer
							</Button>
							<Button
								size="xs"
								color="alternative"
								href="/admin/products/labels?ids={row.productId}"
								target="_blank"
								title="Imprimer l'étiquette (prix TTC si rangé au magasin)"
								aria-label="Imprimer l'étiquette de {row.name}"
							>
								<PrinterOutline class="h-3.5 w-3.5" />
							</Button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

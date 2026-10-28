<script lang="ts">
	/**
	 * Stock d'une ligne de commande ou d'ordre de réparation : où le produit est
	 * rangé (code, description au survol, lien vers l'emplacement) et sortie
	 * manuelle par le magasinier. Rien ne sort automatiquement du stock.
	 *
	 * Couleurs du module Dolibarr « UTILE » : vert = en stock ou sorti, rouge
	 * clair = rupture ou reste à sortir.
	 */
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Input } from 'flowbite-svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { DOLIBARR_STOCK_COLORS as COLORS } from '$lib/admin-colors';
	import type { DocumentProductStock } from '$lib/server/stock-locations';

	let {
		productId,
		stock,
		disabled = false
	}: {
		productId: number;
		stock: DocumentProductStock;
		/** Document figé : la sortie n'est plus proposée. */
		disabled?: boolean;
	} = $props();

	const remaining = $derived(Math.max(0, stock.needed - stock.exited));
	let open = $state(false);
	let locationId = $state<number | null>(null);
	const chosen = $derived(
		stock.placements.find((p) => p.locationId === locationId) ?? stock.placements[0] ?? null
	);
	const max = $derived(Math.min(remaining, chosen?.quantity ?? 0));

	const closeOnSuccess: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') open = false;
		};
</script>

<div class="mt-2 space-y-2 text-xs">
	<div class="flex flex-wrap items-center gap-1.5">
		<span class="text-gray-600">Rangé :</span>
		{#each stock.placements as p (p.locationId)}
			<a
				href="/admin/stock-locations?id={p.locationId}"
				title={p.description ?? p.path}
				style:background-color={COLORS.inStock}
				class="inline-flex cursor-help items-center gap-1 rounded px-1.5 py-0.5 font-mono text-gray-900 hover:underline"
			>
				{p.code ?? p.path} <span class="font-sans font-semibold">×{p.quantity}</span>
			</a>
		{:else}
			<span style:background-color={COLORS.outOfStock} class="rounded px-1.5 py-0.5 text-gray-900">
				Aucun stock rangé
			</span>
		{/each}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<span
			style:background-color={remaining === 0 ? COLORS.inStock : COLORS.outOfStock}
			class="rounded px-1.5 py-0.5 font-medium text-gray-900"
		>
			{remaining === 0
				? `Sorti du stock (${stock.exited}/${stock.needed})`
				: `À sortir : ${remaining} sur ${stock.needed}`}
		</span>
		{#if remaining > 0 && stock.placements.length && !disabled}
			<Button size="xs" color="alternative" onclick={() => (open = !open)}>
				{open ? 'Annuler' : 'Sortir du stock'}
			</Button>
		{/if}
	</div>

	{#if open && chosen}
		<form
			method="POST"
			action="?/stockExit"
			use:enhance={closeOnSuccess}
			data-success="Sortie de stock enregistrée."
			class="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
		>
			<input type="hidden" name="productId" value={productId} />
			<fieldset class="space-y-1">
				<legend class="mb-1 font-medium text-gray-700">Depuis quel emplacement ?</legend>
				{#each stock.placements as p (p.locationId)}
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="radio"
							name="locationId"
							value={p.locationId}
							checked={p.locationId === chosen.locationId}
							onchange={() => (locationId = p.locationId)}
						/>
						<span class="font-mono">{p.code ?? '—'}</span>
						<span class="text-gray-600">{p.path}</span>
						<span class="font-semibold">({p.quantity} en stock)</span>
					</label>
				{/each}
			</fieldset>
			<div class="flex items-center gap-2">
				<div class="w-20">
					<Input
						type="number"
						name="quantity"
						min={1}
						{max}
						value={max}
						size="sm"
						aria-label="Quantité à sortir"
					/>
				</div>
				<span class="text-gray-600">/ {max} possible{max > 1 ? 's' : ''}</span>
				<Button type="submit" size="xs" disabled={max < 1}>Valider la sortie</Button>
			</div>
		</form>
	{/if}
</div>

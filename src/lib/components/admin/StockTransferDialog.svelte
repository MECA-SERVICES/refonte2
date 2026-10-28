<script lang="ts">
	/**
	 * Déplacement de produits vers un autre emplacement, avec relecture avant
	 * validation : chaque ligne montre la photo, la référence, l'origine et la
	 * quantité ; la destination est écrite en entier sur le bouton. Une erreur
	 * de rangement se voit avant d'être faite, pas après.
	 */
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
	import { ArrowRightOutline, CloseOutline } from 'flowbite-svelte-icons';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { formatNumber } from '$lib/money';
	import { placementKey, type StoredRow } from '$lib/stock-locations';
	import LocationPicker from './LocationPicker.svelte';
	import Thumbnail from './Thumbnail.svelte';
	import ConditionBadge from './ConditionBadge.svelte';

	type PickerLocation = {
		id: number;
		name: string;
		code: string | null;
		path: string;
		depth: number;
		isActive: boolean;
		total?: number;
	};

	let {
		open = $bindable(false),
		lines,
		locations,
		locationLabel,
		ondone
	}: {
		open?: boolean;
		/** Lignes à déplacer ; on peut en retirer avant de valider. */
		lines: StoredRow[];
		locations: PickerLocation[];
		locationLabel: (locationId: number) => { path: string; code: string | null };
		/** Après un déplacement réussi : les clés des lignes déplacées. */
		ondone: (keys: string[]) => void;
	} = $props();

	let toId = $state<number | null>(null);
	let reference = $state('');
	let removed = $state<string[]>([]);
	/** Quantités saisies, par ligne ; à défaut, tout ce qui est rangé. */
	let quantities = $state<Record<string, number>>({});
	/** Numéros de série cochés, par ligne. */
	let pickedSerials = $state<Record<string, string[]>>({});

	/** Chaque ouverture repart d'une saisie vierge. */
	$effect(() => {
		if (open) {
			toId = null;
			reference = '';
			removed = [];
			quantities = {};
			pickedSerials = {};
		}
	});

	const kept = $derived(lines.filter((l) => !removed.includes(placementKey(l))));
	const qty = (line: StoredRow) => quantities[placementKey(line)] ?? line.quantity;
	const destination = $derived(toId === null ? null : locationLabel(toId));
	const alreadyThere = $derived(kept.filter((l) => l.locationId === toId));
	/**
	 * Numéros à cocher : au-delà des pièces sans numéro de la ligne, chaque pièce
	 * déplacée doit être désignée par son numéro de série.
	 */
	const serialsNeeded = (line: StoredRow) =>
		Math.max(0, qty(line) - (line.quantity - line.serials.length));
	const picked = (line: StoredRow) => pickedSerials[placementKey(line)] ?? [];
	const invalid = $derived(
		kept.filter(
			(l) =>
				!(qty(l) >= 1 && qty(l) <= l.quantity) ||
				picked(l).length < serialsNeeded(l) ||
				picked(l).length > qty(l)
		)
	);
	const units = $derived(kept.reduce((sum, l) => sum + (qty(l) || 0), 0));
	const ready = $derived(
		toId !== null && kept.length > 0 && alreadyThere.length === 0 && invalid.length === 0
	);

	const submit: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				open = false;
				ondone(kept.map(placementKey));
			}
		};
</script>

<Modal bind:open size="xl" title="Déplacer {kept.length} produit{kept.length > 1 ? 's' : ''}">
	<form
		method="POST"
		action="?/transfer"
		use:enhance={submit}
		data-success="{formatNumber(units)} unité{units > 1 ? 's' : ''} déplacée{units > 1
			? 's'
			: ''} vers {destination?.path ?? ''}."
		class="space-y-5"
	>
		<div>
			<Label class="mb-2 text-base font-semibold">1. Vers quel emplacement ?</Label>
			<LocationPicker
				{locations}
				name="toId"
				bind:value={toId}
				label="Emplacement de destination"
				required
			/>
			{#if destination}
				<p
					class="mt-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900"
				>
					Destination : <strong>{destination.path}</strong>
					{#if destination.code}<span class="font-mono">(code {destination.code})</span>{/if}
				</p>
			{/if}
		</div>

		<div>
			<p class="mb-2 text-base font-semibold text-gray-900">
				2. Vérifiez les produits et les quantités
			</p>
			<ul class="divide-y divide-gray-100 rounded-lg border border-gray-200">
				{#each kept as line, i (placementKey(line))}
					{@const from = locationLabel(line.locationId)}
					{@const key = placementKey(line)}
					<li
						class="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto] {line.locationId ===
						toId
							? 'bg-red-50'
							: ''}"
					>
						<input type="hidden" name="productId" value={line.productId} />
						<input type="hidden" name="fromId" value={line.locationId} />
						<input type="hidden" name="condition" value={line.condition} />
						<div class="flex min-w-0 items-center gap-3">
							<Thumbnail src={line.imageUrl} alt={line.name} />
							<div class="min-w-0">
								<p class="truncate font-medium text-gray-900">{line.name}</p>
								<p class="text-xs text-gray-500">Réf. {line.reference}</p>
							</div>
						</div>
						<div class="min-w-0 text-sm">
							<span class="text-xs text-gray-500">Depuis</span>
							<p class="text-gray-800">
								{from.path}
								{#if from.code}<span class="font-mono text-xs text-gray-600">({from.code})</span
									>{/if}
								<ConditionBadge condition={line.condition} class="ms-1" />
							</p>
							{#if line.serials.length}
								<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
									<span class="text-gray-500">
										N° de série{serialsNeeded(line) ? ` (cochez-en ${serialsNeeded(line)})` : ''} :
									</span>
									{#each line.serials as serial (serial)}
										<label class="flex items-center gap-1 font-mono">
											<input
												type="checkbox"
												name="serials"
												value="{i}:{serial}"
												checked={picked(line).includes(serial)}
												onchange={(e) =>
													(pickedSerials = {
														...pickedSerials,
														[key]: (e.currentTarget as HTMLInputElement).checked
															? [...picked(line), serial]
															: picked(line).filter((x) => x !== serial)
													})}
											/>
											{serial}
										</label>
									{/each}
								</div>
							{/if}
							{#if line.locationId === toId}
								<p class="text-xs font-medium text-red-700">Déjà dans la destination.</p>
							{/if}
						</div>
						<div class="flex items-center gap-1.5">
							<Input
								type="number"
								name="quantity"
								min={1}
								max={line.quantity}
								value={qty(line)}
								oninput={(e) =>
									(quantities = {
										...quantities,
										[key]: Number((e.currentTarget as HTMLInputElement).value)
									})}
								size="sm"
								class="w-20 text-end"
								aria-label="Quantité à déplacer pour {line.name}"
							/>
							<span class="text-sm whitespace-nowrap text-gray-500">/ {line.quantity}</span>
						</div>
						<button
							type="button"
							onclick={() => (removed = [...removed, key])}
							aria-label="Retirer {line.name} du déplacement"
							title="Retirer du déplacement"
							class="justify-self-end rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-700"
						>
							<CloseOutline class="h-4 w-4" />
						</button>
					</li>
				{:else}
					<li class="p-4 text-center text-sm text-gray-500">Plus aucun produit à déplacer.</li>
				{/each}
			</ul>
		</div>

		<div class="max-w-sm">
			<Label for="transfer-reference" class="mb-2">N° de bon (facultatif)</Label>
			<Input
				id="transfer-reference"
				name="reference"
				bind:value={reference}
				placeholder="ex. BS-1042"
			/>
		</div>

		<div class="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4">
			{#if alreadyThere.length}
				<p class="me-auto text-sm text-red-700">
					{alreadyThere.length} produit{alreadyThere.length > 1 ? 's sont' : ' est'} déjà dans la destination
					: retirez-le{alreadyThere.length > 1 ? 's' : ''} ou choisissez un autre emplacement.
				</p>
			{:else if invalid.length}
				<p class="me-auto text-sm text-red-700">
					Quantité à corriger, ou numéros de série à cocher pour les pièces numérotées.
				</p>
			{/if}
			<Button color="alternative" onclick={() => (open = false)}>Annuler</Button>
			<Button type="submit" disabled={!ready}>
				Déplacer {formatNumber(units)} unité{units > 1 ? 's' : ''}
				{#if destination}
					<ArrowRightOutline class="mx-1.5 h-4 w-4" />
					<span class="max-w-72 truncate">{destination.path}</span>
				{/if}
			</Button>
		</div>
	</form>
</Modal>

<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { Button, Card, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import { CloseOutline } from 'flowbite-svelte-icons';
	import { formatNumber } from '$lib/money';
	import { conditionLabel, STOCK_CONDITIONS } from '$lib/stock-locations';
	import { VOUCHER_KINDS } from '$lib/stock-vouchers';
	import { LocationPicker, PageHeader, Thumbnail, listFilterHref } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Saisie d'un bon, comme « Entrer les stocks » et « Sortir les stocks » du
	 * module Dolibarr « UTILE » : on cherche chaque produit (douchette sur l'EAN,
	 * référence ou nom), on l'ajoute au bon, puis on enregistre le tout d'un coup.
	 * Réception : emplacement d'arrivée, état, numéros de série, et les pièces
	 * qui repartent aussitôt. Sortie : l'emplacement et l'état d'où l'on sort.
	 */

	let { data }: PageProps = $props();

	const meta = $derived(VOUCHER_KINDS[data.slug]);
	const isReceipt = $derived(meta.kind === 'receipt');
	const byId = $derived(new Map(data.locations.map((l) => [l.id, l])));
	const pickerLocations = $derived(data.locations.map((l) => ({ ...l, total: l.quantity })));

	type Found = (typeof data.found)[number];
	type Line = {
		key: number;
		product: Found;
		locationId: number | null;
		condition: string;
		quantity: number;
		immediate: number;
		serialsText: string;
	};

	let lines = $state<Line[]>([]);
	let nextKey = 0;
	let searchInput = $state<HTMLInputElement | null>(null);

	const serialsOf = (l: Line) =>
		l.serialsText
			.split(/[\n,;]+/)
			.map((s) => s.trim())
			.filter(Boolean);
	const units = $derived(lines.reduce((s, l) => s + (l.quantity || 0), 0));

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function search(value: string) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			goto(listFilterHref(`/admin/stock/vouchers/${data.slug}/new`, [['q', value.trim()]]), {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}, 300);
	}

	async function add(p: Found) {
		const placed = p.placements[0];
		lines = [
			...lines,
			{
				key: nextKey++,
				product: p,
				// Réception : l'emplacement de la ligne précédente, un carton se rangeant
				// souvent au même endroit ; à défaut, là où le produit est déjà rangé.
				locationId: isReceipt
					? (lines.at(-1)?.locationId ?? placed?.locationId ?? null)
					: (placed?.locationId ?? null),
				condition: placed?.condition ?? 'new',
				quantity: 1,
				immediate: 0,
				serialsText: ''
			}
		];
		await goto(`/admin/stock/vouchers/${data.slug}/new`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
		await tick();
		if (searchInput) {
			searchInput.value = '';
			searchInput.focus();
		}
	}

	/** Douchette : un EAN qui ne désigne qu'un produit l'ajoute d'office. */
	$effect(() => {
		if (/^\d{8,13}$/.test(data.q) && data.found.length === 1) add(data.found[0]);
	});

	/** Sortie : l'emplacement et l'état se choisissent parmi ceux où le produit est rangé. */
	const placementKey = (p: { locationId: number; condition: string }) =>
		`${p.locationId}:${p.condition}`;
	function choosePlacement(line: Line, key: string) {
		const [locationId, condition] = key.split(':');
		line.locationId = Number(locationId);
		line.condition = condition;
	}

	const invalid = $derived(
		lines.filter(
			(l) =>
				!l.locationId ||
				!(l.quantity >= 1) ||
				l.immediate > l.quantity ||
				serialsOf(l).length > l.quantity
		).length
	);
</script>

<svelte:head><title>{meta.create} · Administration</title></svelte:head>

<PageHeader
	title={meta.create}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: meta.title, href: `/admin/stock/vouchers/${data.slug}` },
		{ label: meta.create }
	]}
/>

<form method="POST" action="?/create" use:enhance data-success="Bon enregistré." class="space-y-6">
	<Card class="max-w-none p-5">
		<div class="grid gap-4 md:grid-cols-3">
			<div>
				<Label for="voucher-reference" class="mb-2"
					>{isReceipt ? 'N° de BL fournisseur' : 'N° de bon'}</Label
				>
				<Input
					id="voucher-reference"
					name="reference"
					placeholder={isReceipt ? 'ex. LCL2205YBE01546' : 'Facultatif'}
				/>
			</div>
			{#if isReceipt}
				<div>
					<Label for="voucher-supplier" class="mb-2">Fournisseur</Label>
					<Input id="voucher-supplier" name="supplier" list="suppliers" placeholder="ex. KRAMP" />
					<datalist id="suppliers">
						{#each data.suppliers as s (s)}<option value={s}></option>{/each}
					</datalist>
				</div>
			{:else}
				<div>
					<Label for="voucher-reason" class="mb-2">Motif</Label>
					<Select
						id="voucher-reason"
						name="reason"
						placeholder=""
						value="normal"
						items={[
							{ value: 'normal', name: 'Normal' },
							{ value: 'consumable', name: 'Consommable' },
							{ value: 'investment', name: 'Investissement' }
						]}
					/>
				</div>
			{/if}
			<div>
				<Label for="voucher-note" class="mb-2">Note</Label>
				<Input id="voucher-note" name="note" />
			</div>
		</div>
	</Card>

	<Card class="max-w-none p-5">
		<label for="voucher-search" class="mb-2 block text-sm font-semibold text-gray-900">
			Ajouter un produit : EAN (douchette), référence ou nom
		</label>
		<input
			bind:this={searchInput}
			id="voucher-search"
			type="search"
			value={data.q}
			oninput={(e) => search(e.currentTarget.value)}
			onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
			autocomplete="off"
			placeholder="ex. 3165140000000, ALK-474669, courroie mtd"
			class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
		/>
		{#if data.q}
			<ul class="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
				{#each data.found as p (p.productId)}
					<li class="flex items-center gap-3 p-2 text-sm">
						<Thumbnail src={p.imageUrl} alt={p.name} />
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium text-gray-900">{p.name}</p>
							<p class="text-xs text-gray-500">
								Réf. {p.reference}{p.ean13 ? ` · EAN ${p.ean13}` : ''} · stock {p.stock}{p.isActive
									? ''
									: ' · hors boutique'}
							</p>
						</div>
						<Button
							size="xs"
							onclick={() => add(p)}
							disabled={!isReceipt && !p.placements.length}
							title={!isReceipt && !p.placements.length ? 'Aucun stock rangé à sortir' : undefined}
						>
							Ajouter
						</Button>
					</li>
				{:else}
					<li class="p-3 text-sm text-gray-500">
						{data.q.length < 2 ? 'Tapez au moins deux caractères.' : 'Aucun produit ne correspond.'}
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card class="max-w-none p-5">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">
			Lignes du bon <span class="text-sm font-normal text-gray-500"
				>({lines.length} · {formatNumber(units)} pièces)</span
			>
		</h2>
		{#if lines.length === 0}
			<p class="py-6 text-center text-sm text-gray-500">
				Cherchez un produit ci-dessus pour l'ajouter au bon.
			</p>
		{:else}
			<ul class="divide-y divide-gray-100">
				{#each lines as line, i (line.key)}
					<li
						class="grid gap-3 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_8rem_6rem_6rem_minmax(0,1fr)_auto] lg:items-start"
					>
						<input type="hidden" name="productId" value={line.product.productId} />
						<div class="flex min-w-0 items-start gap-3">
							<Thumbnail src={line.product.imageUrl} alt={line.product.name} />
							<div class="min-w-0 text-sm">
								<p class="font-medium text-gray-900">{line.product.name}</p>
								<p class="text-xs text-gray-500">Réf. {line.product.reference}</p>
							</div>
						</div>
						{#if isReceipt}
							<div>
								<span class="mb-1 block text-xs text-gray-500">Rangé dans</span>
								<LocationPicker
									locations={pickerLocations}
									name="locationId"
									bind:value={line.locationId}
									label="Emplacement de la ligne {i + 1}"
									required
								/>
							</div>
							<div>
								<span class="mb-1 block text-xs text-gray-500">État</span>
								<Select
									name="condition"
									items={[...STOCK_CONDITIONS]}
									bind:value={line.condition}
									placeholder=""
									size="sm"
								/>
							</div>
						{:else}
							<div class="lg:col-span-2">
								<span class="mb-1 block text-xs text-gray-500">Sort de</span>
								<input type="hidden" name="locationId" value={line.locationId ?? ''} />
								<input type="hidden" name="condition" value={line.condition} />
								<Select
									size="sm"
									placeholder=""
									value={line.locationId
										? placementKey({ locationId: line.locationId, condition: line.condition })
										: ''}
									onchange={(e) =>
										choosePlacement(line, (e.currentTarget as HTMLSelectElement).value)}
									items={line.product.placements.map((p) => ({
										value: placementKey(p),
										name: `${byId.get(p.locationId)?.code ?? byId.get(p.locationId)?.path} · ${conditionLabel(p.condition)} · ${p.quantity} en stock`
									}))}
								/>
							</div>
						{/if}
						<div>
							<span class="mb-1 block text-xs text-gray-500">{isReceipt ? 'Reçu' : 'Quantité'}</span
							>
							<Input
								name="quantity"
								type="number"
								min={1}
								bind:value={line.quantity}
								size="sm"
								aria-label="Quantité de la ligne {i + 1}"
							/>
						</div>
						{#if isReceipt}
							<div>
								<span
									class="mb-1 block text-xs text-gray-500"
									title="Pièces commandées pour un client, qui repartent aussitôt">Repart</span
								>
								<Input
									name="immediate"
									type="number"
									min={0}
									max={line.quantity}
									bind:value={line.immediate}
									size="sm"
									aria-label="Pièces qui repartent aussitôt, ligne {i + 1}"
								/>
							</div>
						{:else}
							<input type="hidden" name="immediate" value="0" />
						{/if}
						<div class:lg:col-span-2={!isReceipt}>
							<span class="mb-1 block text-xs text-gray-500">N° de série (un par ligne)</span>
							<Textarea
								rows={1}
								bind:value={line.serialsText}
								class="font-mono text-xs"
								aria-label="Numéros de série de la ligne {i + 1}"
							/>
							{#each serialsOf(line) as serial (serial)}
								<input type="hidden" name="serials" value="{i}:{serial}" />
							{/each}
							{#if serialsOf(line).length > line.quantity}
								<p class="mt-1 text-xs text-red-700">Plus de numéros que de pièces.</p>
							{/if}
						</div>
						<button
							type="button"
							onclick={() => (lines = lines.filter((l) => l.key !== line.key))}
							aria-label="Retirer {line.product.name} du bon"
							class="justify-self-end rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-700"
						>
							<CloseOutline class="h-4 w-4" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="mt-4 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
			{#if invalid}
				<p class="me-auto text-sm text-red-700">
					{invalid} ligne{invalid > 1 ? 's' : ''} à compléter (emplacement, quantité, numéros).
				</p>
			{/if}
			<Button color="alternative" href="/admin/stock/vouchers/{data.slug}">Annuler</Button>
			<Button type="submit" disabled={!lines.length || invalid > 0}>
				Enregistrer la {meta.one} ({formatNumber(units)} pièce{units > 1 ? 's' : ''})
			</Button>
		</div>
	</Card>
</form>

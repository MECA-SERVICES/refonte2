<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { Button, Card, Input, Label, Select } from 'flowbite-svelte';
	import { CloseOutline, DownloadOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { formatNumber, formatPrice } from '$lib/money';
	import { DOLIBARR_STOCK_COLORS as COLORS } from '$lib/admin-colors';
	import { INVENTORY_SCOPES } from '$lib/inventory';
	import { conditionLabel, STOCK_CONDITIONS } from '$lib/stock-locations';
	import {
		ConditionBadge,
		ConfirmDialog,
		LocationPicker,
		PageHeader,
		StatCard,
		StateBadge,
		Thumbnail,
		listFilterHref
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Comptage d'un inventaire, comme l'écran « Faire l'inventaire » du module
	 * Dolibarr « UTILE » : on choisit l'emplacement qu'on compte, on cherche le
	 * produit (douchette sur l'EAN, ou référence, ou nom), on saisit quantité,
	 * état et numéro de série. Les comptages s'ajoutent. Les écarts avec le
	 * stock se relisent avant de valider.
	 */

	let { data }: PageProps = $props();

	const inv = $derived(data.inventory);
	const isOpen = $derived(inv.status === 'open');
	const byId = $derived(new Map(data.locations.map((l) => [l.id, l])));
	const pickerLocations = $derived(data.locations.map((l) => ({ ...l, total: l.quantity })));
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

	// ----- Comptage -----

	/** L'emplacement en cours de comptage reste choisi d'un produit à l'autre. */
	let locationId = $state<number | null>(null);
	let productId = $state<number | null>(null);
	let condition = $state<string>('new');
	let quantity = $state(1);
	let serialNumber = $state('');
	let note = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	const product = $derived(data.found.find((p) => p.productId === productId) ?? null);

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function search(value: string) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			goto(
				listFilterHref(`/admin/inventories/${inv.id}`, [
					['q', value.trim()],
					['scope', data.scope]
				]),
				{ keepFocus: true, noScroll: true, replaceState: true }
			);
		}, 300);
	}

	/** Douchette : un EAN qui ne désigne qu'un produit le choisit d'office. */
	$effect(() => {
		if (/^\d{8,13}$/.test(data.q) && data.found.length === 1) choose(data.found[0]);
	});

	function choose(p: (typeof data.found)[number]) {
		productId = p.productId;
		serialNumber = '';
		quantity = 1;
		note = '';
		// Emplacement proposé : là où le produit est rangé, si rien n'est choisi.
		if (locationId === null && p.placements[0]) locationId = p.placements[0].locationId;
		if (p.placements[0]) condition = p.placements[0].condition;
	}

	const afterCount: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type !== 'success') return;
			productId = null;
			serialNumber = '';
			quantity = 1;
			note = '';
			await goto(listFilterHref(`/admin/inventories/${inv.id}`, [['scope', data.scope]]), {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
			await tick();
			if (searchInput) {
				searchInput.value = '';
				searchInput.focus();
			}
		};

	// ----- Comptages saisis -----

	let countFilter = $state('');
	let countLocation = $state<number | null>(null);
	const counts = $derived.by(() => {
		const q = countFilter.trim().toLowerCase();
		return data.counts.filter(
			(c) =>
				(countLocation === null || c.locationId === countLocation) &&
				(!q || [c.name, c.reference, c.ean13].some((v) => v?.toLowerCase().includes(q)))
		);
	});

	const keepValues: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });

	// ----- Écarts et validation -----

	const gapStats = $derived({
		lines: data.gaps.length,
		plus: data.gaps.filter((g) => g.delta > 0).reduce((s, g) => s + g.delta, 0),
		minus: data.gaps.filter((g) => g.delta < 0).reduce((s, g) => s - g.delta, 0)
	});
	let confirmOpen = $state(false);
	let validateForm = $state<HTMLFormElement | null>(null);

	function locationText(id: number) {
		const l = byId.get(id);
		return { code: l?.code ?? null, path: l?.path ?? '—', description: l?.description ?? null };
	}
</script>

<svelte:head><title>{inv.name} · Inventaires</title></svelte:head>

<PageHeader
	title={inv.name}
	subtitle={isOpen
		? 'Comptage en cours : choisissez l’emplacement, cherchez le produit, comptez.'
		: `Validé le ${dateFmt.format(new Date(inv.validatedAt ?? inv.createdAt))}${inv.legacyDoliId ? ' · repris de Dolibarr' : ''}`}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Inventaires', href: '/admin/inventories' },
		{ label: inv.name }
	]}
>
	{#snippet actions()}
		<StateBadge color={isOpen ? 'yellow' : 'green'} label={isOpen ? 'En cours' : 'Validé'} />
		<Button color="alternative" href="/admin/inventories/{inv.id}/export">
			<DownloadOutline class="me-2 h-4 w-4" /> Exporter (CSV)
		</Button>
	{/snippet}
</PageHeader>

<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard label="Références comptées" value={inv.products} />
	<StatCard label="Unités comptées" value={inv.units} />
	<StatCard label="Lignes" value={inv.lines} hint="Produit × emplacement × état" />
	<StatCard
		label="Valeur d'achat HT"
		value={formatPrice(inv.value)}
		hint="Prix d'achat figé au comptage"
	/>
</div>

{#if isOpen}
	<!-- ================= Compter ================= -->
	<Card class="mb-6 max-w-none p-5">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Compter</h2>
		<div class="grid gap-4 lg:grid-cols-2">
			<div>
				<Label class="mb-2">1. Emplacement compté</Label>
				<LocationPicker
					locations={pickerLocations}
					name="locationId"
					bind:value={locationId}
					label="Emplacement compté"
					required
				/>
				{#if locationId !== null}
					<p class="mt-1 text-xs text-gray-600">
						{locationText(locationId).description ?? locationText(locationId).path}
					</p>
				{/if}
			</div>
			<div>
				<label for="count-search" class="mb-2 block text-sm font-medium text-gray-900">
					2. Produit : EAN (douchette), référence ou nom
				</label>
				<input
					bind:this={searchInput}
					id="count-search"
					type="search"
					value={data.q}
					oninput={(e) => search(e.currentTarget.value)}
					placeholder="ex. 3165140000000, ALK-474669, courroie mtd"
					autocomplete="off"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
				/>
			</div>
		</div>

		{#if data.q && !product}
			<ul class="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
				{#each data.found as p (p.productId)}
					<li class="flex items-center gap-3 p-2">
						<Thumbnail src={p.imageUrl} alt={p.name} />
						<div class="min-w-0 flex-1 text-sm">
							<p class="truncate font-medium text-gray-900">{p.name}</p>
							<p class="text-xs text-gray-500">
								Réf. {p.reference}{p.ean13 ? ` · EAN ${p.ean13}` : ''} · stock {p.stock}
								{#each p.placements.slice(0, 4) as s (`${s.locationId}:${s.condition}`)}
									<span
										class="ms-1 font-mono"
										title={locationText(s.locationId).description ??
											locationText(s.locationId).path}
										>{locationText(s.locationId).code}×{s.quantity}</span
									>
								{/each}
							</p>
						</div>
						<Button size="xs" onclick={() => choose(p)}>Compter</Button>
					</li>
				{:else}
					<li class="p-3 text-sm text-gray-500">
						{data.q.length < 2 ? 'Tapez au moins deux caractères.' : 'Aucun produit ne correspond.'}
					</li>
				{/each}
			</ul>
		{/if}

		{#if product}
			<form
				method="POST"
				action="?/count"
				use:enhance={afterCount}
				data-success="Comptage enregistré."
				class="mt-4 rounded-lg border-2 border-primary-500 p-4"
			>
				<input type="hidden" name="productId" value={product.productId} />
				<input type="hidden" name="locationId" value={locationId ?? ''} />
				<div class="mb-4 flex items-start gap-3">
					<Thumbnail src={product.imageUrl} alt={product.name} />
					<div class="min-w-0 flex-1">
						<p class="font-semibold text-gray-900">{product.name}</p>
						<p class="text-xs text-gray-500">
							Réf. {product.reference}{product.ean13 ? ` · EAN ${product.ean13}` : ''} · prix d'achat
							{product.purchasePrice ? formatPrice(product.purchasePrice) : 'non renseigné'}
						</p>
						<p class="mt-1 text-sm">
							Compté en
							<strong
								>{locationId === null
									? '— choisissez l’emplacement —'
									: locationText(locationId).path}</strong
							>
						</p>
					</div>
					<button
						type="button"
						onclick={() => (productId = null)}
						aria-label="Changer de produit"
						class="rounded p-1.5 text-gray-500 hover:bg-gray-100"
					>
						<CloseOutline class="h-4 w-4" />
					</button>
				</div>
				<div
					class="grid gap-3 sm:grid-cols-[8rem_7rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
				>
					<div>
						<Label for="count-condition" class="mb-2">État</Label>
						<Select
							id="count-condition"
							name="condition"
							items={[...STOCK_CONDITIONS]}
							bind:value={condition}
							placeholder=""
						/>
					</div>
					<div>
						<Label for="count-qty" class="mb-2">Quantité</Label>
						<Input
							id="count-qty"
							name="quantity"
							type="number"
							bind:value={quantity}
							disabled={!!serialNumber}
						/>
						{#if serialNumber}<input type="hidden" name="quantity" value="1" />{/if}
					</div>
					<div>
						<Label for="count-serial" class="mb-2">N° de série</Label>
						<Input
							id="count-serial"
							name="serialNumber"
							bind:value={serialNumber}
							placeholder="Une pièce"
						/>
					</div>
					<div>
						<Label for="count-note" class="mb-2">Note</Label>
						<Input id="count-note" name="note" bind:value={note} />
					</div>
					<Button type="submit" disabled={locationId === null}>Compter</Button>
				</div>
			</form>
		{/if}
	</Card>
{/if}

<!-- ================= Comptages ================= -->
<Card class="mb-6 max-w-none p-5">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-lg font-semibold text-gray-900">
			Comptages <span class="text-sm font-normal text-gray-500"
				>({formatNumber(counts.length)})</span
			>
		</h2>
		<div class="flex flex-wrap gap-2">
			<Input
				type="search"
				bind:value={countFilter}
				placeholder="Filtrer : nom, référence, EAN"
				aria-label="Filtrer les comptages"
				class="w-60"
			/>
			<div class="w-72">
				<LocationPicker
					locations={pickerLocations.filter((l) => data.counts.some((c) => c.locationId === l.id))}
					name="countLocation"
					bind:value={countLocation}
					label="Filtrer par emplacement"
					placeholder="Tous les emplacements"
				/>
			</div>
		</div>
	</div>

	{#if counts.length === 0}
		<p class="py-6 text-center text-sm text-gray-500">
			Aucun comptage{countFilter || countLocation ? ' pour ce filtre' : ''}.
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
					<tr>
						<th scope="col" class="py-2 pe-3 text-start">Produit</th>
						<th scope="col" class="px-3 py-2 text-start">Emplacement</th>
						<th scope="col" class="px-3 py-2 text-end">Quantité</th>
						<th scope="col" class="px-3 py-2 text-end">Achat HT</th>
						<th scope="col" class="px-3 py-2 text-end">Total HT</th>
						<th scope="col" class="py-2 ps-3"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each counts.slice(0, 300) as c (c.id)}
						{@const at = locationText(c.locationId)}
						{@const price = Number(c.purchasePrice ?? 0)}
						<tr class="align-top">
							<td class="py-2 pe-3">
								<div class="flex items-start gap-3">
									<Thumbnail src={c.imageUrl} alt={c.name} size="sm" />
									<div class="min-w-0">
										<a
											href="/admin/products/{c.productId}"
											class="font-medium text-gray-900 hover:underline">{c.name}</a
										>
										<p class="text-xs text-gray-500">
											Réf. {c.reference}{c.ean13 ? ` · EAN ${c.ean13}` : ''}
										</p>
										{#if c.serials.length}
											<div class="mt-1 flex flex-wrap gap-1">
												{#each c.serials as s (s.id)}
													<span
														class="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs"
													>
														{s.serial}
														{#if isOpen}
															<form
																method="POST"
																action="?/removeSerial"
																use:enhance
																data-success="Numéro retiré du comptage."
															>
																<input type="hidden" name="serialId" value={s.id} />
																<button
																	type="submit"
																	aria-label="Retirer le n° {s.serial}"
																	class="text-gray-500 hover:text-red-700"
																>
																	<CloseOutline class="h-3 w-3" />
																</button>
															</form>
														{/if}
													</span>
												{/each}
											</div>
										{/if}
										{#if c.note}<p class="mt-1 text-xs text-gray-600">{c.note}</p>{/if}
									</div>
								</div>
							</td>
							<td class="px-3 py-2">
								<span class="cursor-help font-mono text-xs" title={at.description ?? at.path}
									>{at.code ?? at.path}</span
								>
								<ConditionBadge condition={c.condition} class="ms-1" />
							</td>
							<td class="px-3 py-2 text-end">
								{#if isOpen}
									<form
										method="POST"
										action="?/setQuantity"
										use:enhance={keepValues}
										data-success="Quantité corrigée."
										class="flex justify-end gap-1"
									>
										<input type="hidden" name="lineId" value={c.id} />
										<div class="w-20">
											<Input
												type="number"
												name="quantity"
												min={0}
												value={c.quantity}
												size="sm"
												aria-label="Quantité comptée de {c.name}"
											/>
										</div>
										<Button type="submit" size="xs" color="alternative">OK</Button>
									</form>
								{:else}
									<span class="font-semibold tabular-nums">{formatNumber(c.quantity)}</span>
								{/if}
							</td>
							<td
								class="px-3 py-2 text-end tabular-nums"
								style:background-color={price ? undefined : COLORS.alert}
								title={price ? undefined : "Prix d'achat à 0"}
							>
								{formatPrice(price)}
							</td>
							<td class="px-3 py-2 text-end tabular-nums">{formatPrice(price * c.quantity)}</td>
							<td class="py-2 ps-3 text-end">
								{#if isOpen}
									<form
										method="POST"
										action="?/setQuantity"
										use:enhance
										data-success="Ligne supprimée."
									>
										<input type="hidden" name="lineId" value={c.id} />
										<input type="hidden" name="quantity" value="0" />
										<button
											type="submit"
											aria-label="Supprimer le comptage de {c.name}"
											class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-700"
										>
											<TrashBinOutline class="h-4 w-4" />
										</button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if counts.length > 300}
				<p class="mt-3 text-center text-xs text-gray-500">
					300 premières lignes sur {formatNumber(counts.length)} : filtrez, ou exportez le CSV.
				</p>
			{/if}
		</div>
	{/if}
</Card>

{#if isOpen}
	<!-- ================= Écarts et validation ================= -->
	<Card class="max-w-none p-5">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="text-lg font-semibold text-gray-900">Écarts avec le stock</h2>
				<p class="text-sm text-gray-600">
					{formatNumber(gapStats.lines)} lignes changent : +{formatNumber(gapStats.plus)} / −{formatNumber(
						gapStats.minus
					)} unités.
				</p>
			</div>
			<div class="flex gap-1.5">
				{#each INVENTORY_SCOPES as s (s.value)}
					<Button
						size="xs"
						color={data.scope === s.value ? 'primary' : 'alternative'}
						href={listFilterHref(`/admin/inventories/${inv.id}`, [['scope', s.value]])}
						data-sveltekit-noscroll
					>
						{s.name}
					</Button>
				{/each}
			</div>
		</div>

		{#if data.gaps.length}
			<div class="max-h-[28rem] overflow-y-auto">
				<table class="w-full text-sm">
					<thead
						class="sticky top-0 border-b border-gray-200 bg-white text-xs text-gray-600 uppercase"
					>
						<tr>
							<th scope="col" class="py-2 pe-3 text-start">Produit</th>
							<th scope="col" class="px-3 py-2 text-start">Emplacement</th>
							<th scope="col" class="px-3 py-2 text-end">En stock</th>
							<th scope="col" class="px-3 py-2 text-end">Compté</th>
							<th scope="col" class="py-2 ps-3 text-end">Écart</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each data.gaps.slice(0, 500) as g (`${g.productId}:${g.locationId}:${g.condition}`)}
							{@const at = locationText(g.locationId)}
							<tr>
								<td class="py-1.5 pe-3">
									<a href="/admin/products/{g.productId}" class="hover:underline">{g.name}</a>
									<span class="text-xs text-gray-500">· {g.reference}</span>
								</td>
								<td class="px-3 py-1.5">
									<span class="cursor-help font-mono text-xs" title={at.description ?? at.path}
										>{at.code ?? at.path}</span
									>
									{#if g.condition !== 'new'}<span class="ms-1 text-xs"
											>{conditionLabel(g.condition)}</span
										>{/if}
								</td>
								<td class="px-3 py-1.5 text-end tabular-nums">{g.current}</td>
								<td class="px-3 py-1.5 text-end tabular-nums">{g.counted}</td>
								<td
									class="py-1.5 ps-3 text-end font-semibold text-gray-900 tabular-nums"
									style:background-color={g.delta > 0 ? COLORS.inStock : COLORS.outOfStock}
								>
									{g.delta > 0 ? '+' : ''}{g.delta}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if data.gaps.length > 500}
					<p class="mt-2 text-center text-xs text-gray-500">
						500 premiers écarts sur {formatNumber(data.gaps.length)}.
					</p>
				{/if}
			</div>
		{:else}
			<p class="py-4 text-sm text-gray-500">Aucun écart : le stock correspond au comptage.</p>
		{/if}

		<form
			bind:this={validateForm}
			method="POST"
			action="?/validate"
			use:enhance
			data-success="Inventaire validé : le stock a été mis à jour."
			class="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4"
		>
			<input type="hidden" name="scope" value={data.scope} />
			<p class="me-auto text-sm text-gray-600">
				{data.scope === 'all'
					? 'Tout ce qui n’a pas été compté passera à 0, comme la mise à jour du stock de Dolibarr.'
					: 'Seuls les emplacements comptés sont mis à jour ; le reste du stock ne bouge pas.'}
			</p>
			<Button
				type="button"
				color="green"
				disabled={inv.lines === 0}
				onclick={() => (confirmOpen = true)}
			>
				Valider l'inventaire
			</Button>
		</form>
	</Card>

	<ConfirmDialog
		bind:open={confirmOpen}
		title="Valider l'inventaire"
		message="{formatNumber(gapStats.lines)} lignes de stock vont être ajustées (+{formatNumber(
			gapStats.plus
		)} / −{formatNumber(gapStats.minus)} unités). L'inventaire ne pourra plus être modifié."
		confirmLabel="Valider et mettre le stock à jour"
		onconfirm={() => validateForm?.requestSubmit()}
	/>
{/if}

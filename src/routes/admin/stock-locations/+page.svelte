<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { Button, Card, Input } from 'flowbite-svelte';
	import {
		ChevronDownOutline,
		ChevronRightOutline,
		EditOutline,
		ArrowRightOutline,
		CloseOutline,
		PrinterOutline
	} from 'flowbite-svelte-icons';
	import { formatNumber, formatPrice } from '$lib/money';
	import {
		locationScore,
		placementKey,
		subtreeIds,
		subtreeQuantities,
		type StoredRow
	} from '$lib/stock-locations';
	import {
		PageHeader,
		StatCard,
		StateBadge,
		Thumbnail,
		StoredProductsTable,
		StockTransferDialog,
		listFilterHref
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Emplacements de stock : l'arbre du magasin à gauche, l'emplacement ouvert
	 * à droite avec ses sous-emplacements et les produits qui y sont rangés
	 * (photo, stock boutique, autres emplacements). La recherche du haut répond
	 * à la question du comptoir : « où est rangé ce produit ? ».
	 *
	 * Les produits se cochent dans n'importe quelle liste (emplacement ouvert ou
	 * recherche) ; la sélection reste affichée en bas de page pendant qu'on
	 * navigue, puis se déplace d'un coup après relecture.
	 */

	let { data }: PageProps = $props();

	type Location = (typeof data.locations)[number];

	const PAGE_SIZE = 100;

	const byId = $derived(new Map(data.locations.map((l) => [l.id, l])));
	const totals = $derived(subtreeQuantities(data.locations));
	/** Enfants de chaque emplacement, dans l'ordre de l'arbre ; clé 0 pour les racines. */
	const childrenIndex = $derived.by(() => {
		const index: Record<number, Location[]> = {};
		for (const l of data.locations) (index[l.ancestorIds.at(-1) ?? 0] ??= []).push(l);
		return index;
	});
	const childrenOf = (id: number | null): Location[] => childrenIndex[id ?? 0] ?? [];
	const pickerLocations = $derived(
		data.locations.map((l) => ({ ...l, total: totals.get(l.id) ?? 0 }))
	);

	const selected = $derived(data.selectedId === null ? null : (byId.get(data.selectedId) ?? null));
	const children = $derived(childrenOf(selected?.id ?? null));
	const occupied = $derived(data.locations.filter((l) => l.quantity > 0).length);

	/** Chemin lisible et code d'étiquette d'un emplacement. */
	function locationLabel(id: number) {
		const l = byId.get(id);
		return {
			path: l?.path ?? 'Emplacement supprimé',
			code: l?.code ?? null,
			description: l?.description ?? null
		};
	}

	// ----- Recherche « où est rangé ce produit ? » -----

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	/** Recherche au fil de la frappe, sans perdre le focus ni l'emplacement ouvert. */
	function search(value: string) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			goto(
				listFilterHref('/admin/stock-locations', [
					['id', data.selectedId],
					['q', value.trim()]
				]),
				{
					keepFocus: true,
					noScroll: true,
					replaceState: true
				}
			);
		}, 300);
	}
	const foundProducts = $derived(new Set(data.found.map((r) => r.productId)).size);

	// ----- Sélection et déplacement -----

	const selection = new SvelteMap<string, StoredRow>();
	let showSelection = $state(false);
	let moveOpen = $state(false);
	/** Lignes figées à l'ouverture : la sélection peut changer pendant la relecture. */
	let moveLines = $state<StoredRow[]>([]);
	const selectedRows = $derived([...selection.values()]);
	const selectedUnits = $derived(selectedRows.reduce((sum, r) => sum + r.quantity, 0));
	const selectedOrigins = $derived(new Set(selectedRows.map((r) => r.locationId)).size);

	function startMove(rows: StoredRow[]) {
		moveLines = rows;
		moveOpen = true;
	}
	function moved(keys: string[]) {
		for (const key of keys) selection.delete(key);
		if (!selection.size) showSelection = false;
	}

	// ----- Arbre -----

	/** Branches ouvertes : celles du chemin de l'emplacement ouvert, plus les clics. */
	const opened = new SvelteSet<number>();
	$effect(() => {
		for (const id of selected?.ancestorIds ?? []) opened.add(id);
	});
	function toggle(id: number) {
		if (opened.has(id)) opened.delete(id);
		else opened.add(id);
	}

	let treeQuery = $state('');
	const treeMatches = $derived(
		treeQuery.trim()
			? data.locations
					.map((l, order) => ({ l, order, score: locationScore(treeQuery, l) }))
					.filter((r) => r.score !== null)
					.sort((a, b) => a.score! - b.score! || a.order - b.order)
					.map((r) => r.l)
			: []
	);

	// ----- Emplacement ouvert -----

	let productFilter = $state('');
	let showAll = $state(false);

	/**
	 * Réinitialise le filtre quand on change d'emplacement. `selectedId` est un
	 * $derived : il ne change pas quand un déplacement recharge les données.
	 */
	const selectedId = $derived(data.selectedId);
	$effect(() => {
		void selectedId;
		untrack(() => {
			productFilter = '';
			showAll = false;
		});
	});

	const stored = $derived(data.stored);
	const filtered = $derived.by(() => {
		const q = productFilter.trim().toLowerCase();
		if (!q) return stored;
		return stored.filter((p) =>
			[p.name, p.reference, p.ean13, p.brandName].some((v) => v?.toLowerCase().includes(q))
		);
	});
	const visible = $derived(showAll ? filtered : filtered.slice(0, PAGE_SIZE));

	const units = $derived(stored.reduce((sum, p) => sum + p.quantity, 0));
	const value = $derived(
		stored.reduce((sum, p) => sum + p.quantity * Number(p.purchasePrice ?? 0), 0)
	);
	const distinctProducts = $derived(new Set(stored.map((p) => p.productId)).size);

	/** Produits rangés sous chaque sous-emplacement (sous-arbre compris). */
	function productsUnder(location: Location) {
		if (location.id === selected?.id) return distinctProducts;
		const ids = new Set(subtreeIds(data.locations, location.id));
		return new Set(stored.filter((p) => ids.has(p.locationId)).map((p) => p.productId)).size;
	}
</script>

<svelte:head><title>Emplacements de stock · Administration</title></svelte:head>

<PageHeader
	title="Emplacements de stock"
	subtitle="Magasin, atelier et réserves, repris de Dolibarr avec le stock rangé de chaque emplacement"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Emplacements de stock' }]}
/>

<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="Emplacements"
		value={data.locations.length}
		hint="{formatNumber(occupied)} occupés"
	/>
	<StatCard
		label="Produits rangés"
		value={data.overview.products}
		hint={data.overview.mismatches
			? `${formatNumber(data.overview.mismatches)} avec un stock boutique différent`
			: 'Stock boutique = somme des emplacements'}
	/>
	<StatCard label="Unités rangées" value={data.overview.units} />
	<StatCard
		label="Valeur au prix d'achat"
		value={formatPrice(data.overview.value)}
		hint="Produits sans prix d'achat comptés à 0"
	/>
</div>

<!-- ================= Où est rangé ce produit ? ================= -->
<Card class="mb-6 max-w-none p-4">
	<label for="stock-search" class="mb-2 block text-sm font-semibold text-gray-900">
		Où est rangé ce produit ?
	</label>
	<Input
		id="stock-search"
		type="search"
		value={data.q}
		oninput={(e) => search((e.currentTarget as HTMLInputElement).value)}
		placeholder="Nom, référence ou EAN : les résultats s'affichent pendant la frappe"
		size="lg"
	/>

	{#if data.q}
		<div class="mt-4">
			{#if data.q.length < 2}
				<p class="text-sm text-gray-500">Tapez au moins deux caractères.</p>
			{:else if data.found.length === 0}
				<p class="text-sm text-gray-500">
					Aucun produit rangé ne correspond à « {data.q} ». Un produit absent de MSShop (créé seulement
					dans Dolibarr) n'apparaît pas encore.
				</p>
			{:else}
				<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
					<p class="text-sm text-gray-700">
						<strong>{formatNumber(foundProducts)} produit{foundProducts > 1 ? 's' : ''}</strong>
						rangé{foundProducts > 1 ? 's' : ''} dans
						<strong
							>{formatNumber(data.found.length)} emplacement{data.found.length > 1
								? 's'
								: ''}</strong
						>
						pour « {data.q} »{data.found.length >= 100
							? ' (100 premières lignes, précisez la recherche)'
							: ''}. Cochez ceux à déplacer.
					</p>
					<a
						href={listFilterHref('/admin/stock-locations', [['id', data.selectedId]])}
						class="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
					>
						<CloseOutline class="h-3.5 w-3.5" /> Effacer la recherche
					</a>
				</div>
				<StoredProductsTable
					rows={data.found}
					{selection}
					{locationLabel}
					onmove={(r) => startMove([r])}
				/>
			{/if}
		</div>
	{/if}
</Card>

<div class="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
	<!-- ================= Arbre ================= -->
	<Card class="max-w-none p-4 lg:sticky lg:top-4">
		<label for="tree-filter" class="mb-2 block text-sm font-semibold text-gray-900">
			Emplacements
		</label>
		<Input
			id="tree-filter"
			type="search"
			bind:value={treeQuery}
			placeholder="Filtrer : code (4372) ou nom (droite 43 r7)"
			class="mb-3"
		/>
		<nav aria-label="Emplacements" class="max-h-[70vh] overflow-y-auto">
			{#if treeQuery.trim()}
				<ul class="space-y-0.5">
					{#each treeMatches.slice(0, 100) as l (l.id)}
						<li>{@render treeLink(l, true)}</li>
					{:else}
						<li class="py-6 text-center text-sm text-gray-500">Aucun emplacement.</li>
					{/each}
				</ul>
			{:else}
				{@render tree(null)}
			{/if}
		</nav>
	</Card>

	<!-- ================= Emplacement ouvert ================= -->
	<div class="min-w-0 space-y-6">
		{#if selected}
			<Card class="max-w-none p-5">
				<nav aria-label="Chemin de l'emplacement" class="mb-2 flex flex-wrap gap-1 text-sm">
					<a href="?" class="text-primary-700 hover:underline">Tous</a>
					{#each selected.ancestorIds as id (id)}
						<span class="text-gray-400" aria-hidden="true">›</span>
						<a href="?id={id}" class="text-primary-700 hover:underline">{byId.get(id)?.name}</a>
					{/each}
				</nav>
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 class="text-xl font-bold break-words text-gray-900">{selected.name}</h2>
						<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
							{#if selected.code}
								<span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
									Code {selected.code}
								</span>
							{/if}
							{#if !selected.isActive}<StateBadge color="gray" label="Désactivé" />{/if}
							{#if selected.legacyDoliId}<span>Repris de Dolibarr</span>{/if}
						</div>
					</div>
					<Button
						size="xs"
						color="alternative"
						href="/admin/stock-locations/manage?id={selected.id}"
					>
						<EditOutline class="me-1 h-3.5 w-3.5" /> Gérer l'emplacement
					</Button>
				</div>

				<dl class="mt-5 grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 sm:grid-cols-4">
					{@render figure('Sous-emplacements', formatNumber(children.length))}
					{@render figure('Produits', formatNumber(distinctProducts))}
					{@render figure('Unités', formatNumber(units))}
					{@render figure("Valeur d'achat", formatPrice(value))}
				</dl>
			</Card>
		{:else}
			<Card class="max-w-none p-5">
				<h2 class="mb-1 text-lg font-semibold text-gray-900">Tout le stock</h2>
				<p class="mb-4 text-sm text-gray-500">
					Ouvrez un emplacement dans l'arbre, tapez son code, ou cherchez un produit ci-dessus.
				</p>
				<p class="text-sm text-gray-500">
					Pour créer, renommer ou supprimer des emplacements :
					<a href="/admin/stock-locations/manage" class="text-primary-700 hover:underline"
						>Paramètres › Emplacements de stock</a
					>.
				</p>
			</Card>
		{/if}

		{#if children.length}
			<section aria-label="Sous-emplacements">
				<h3 class="mb-3 text-sm font-semibold tracking-wide text-gray-600 uppercase">
					{selected ? 'Sous-emplacements' : 'Emplacements principaux'}
				</h3>
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{#each children as child (child.id)}
						{@const childUnits = totals.get(child.id) ?? 0}
						<a
							href="?id={child.id}"
							class="block rounded-lg border border-gray-200 bg-white p-4 hover:border-primary-500 hover:shadow-sm {child.isActive
								? ''
								: 'opacity-60'}"
						>
							<div class="flex items-start justify-between gap-2">
								<span class="font-semibold break-words text-gray-900">{child.name}</span>
								{#if child.code}
									<span
										class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700"
									>
										{child.code}
									</span>
								{/if}
							</div>
							<p class="mt-2 text-sm text-gray-500">
								{#if childUnits}
									{#if selected}{formatNumber(productsUnder(child))} produits ·{/if}
									{formatNumber(childUnits)} unités
								{:else}
									Vide
								{/if}
								{#if childrenOf(child.id).length}
									· {childrenOf(child.id).length} sous-emplacements
								{/if}
							</p>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if selected}
			<Card class="max-w-none p-5">
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Produits rangés</h3>
						<p class="text-sm text-gray-500">
							{children.length ? 'Ici et dans les sous-emplacements. ' : ''}Cochez les produits à
							déplacer, ou utilisez « Déplacer » sur une ligne.
						</p>
					</div>
					{#if stored.length > 10}
						<Input
							type="search"
							bind:value={productFilter}
							placeholder="Filtrer : nom, référence, marque"
							aria-label="Filtrer les produits rangés"
							class="w-64"
						/>
					{/if}
				</div>
				{#if stored.length === 0}
					<p class="py-6 text-center text-sm text-gray-500">Aucun produit rangé ici.</p>
				{:else}
					<StoredProductsTable
						rows={visible}
						{selection}
						{locationLabel}
						relativeTo={selected.path}
						onmove={(r) => startMove([r])}
					/>
					{#if filtered.length > visible.length}
						<div class="mt-4 text-center">
							<Button color="alternative" size="sm" onclick={() => (showAll = true)}>
								Afficher les {formatNumber(filtered.length)} produits
							</Button>
						</div>
					{/if}
				{/if}
			</Card>
		{/if}
	</div>
</div>

<!-- ================= Sélection ================= -->
{#if selection.size}
	<div class="sticky bottom-4 z-30 mt-6">
		<section
			aria-label="Produits sélectionnés"
			class="rounded-xl border-2 border-primary-500 bg-white shadow-lg"
		>
			{#if showSelection}
				<ul class="max-h-72 divide-y divide-gray-100 overflow-y-auto border-b border-gray-200">
					{#each selectedRows as row (placementKey(row))}
						{@const from = locationLabel(row.locationId)}
						<li class="flex items-center gap-3 px-4 py-2 text-sm">
							<Thumbnail src={row.imageUrl} alt={row.name} size="sm" />
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium text-gray-900">{row.name}</p>
								<p class="truncate text-xs text-gray-500">
									Réf. {row.reference} · {from.path}{from.code ? ` (${from.code})` : ''}
								</p>
							</div>
							<span class="font-semibold tabular-nums">×{formatNumber(row.quantity)}</span>
							<button
								type="button"
								onclick={() => selection.delete(placementKey(row))}
								aria-label="Retirer {row.name} de la sélection"
								class="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-700"
							>
								<CloseOutline class="h-4 w-4" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="flex flex-wrap items-center gap-3 px-4 py-3">
				<p class="text-sm text-gray-900">
					<strong
						>{formatNumber(selection.size)} produit{selection.size > 1 ? 's' : ''} sélectionné{selection.size >
						1
							? 's'
							: ''}</strong
					>
					<span class="text-gray-600">
						· {formatNumber(selectedUnits)} unité{selectedUnits > 1 ? 's' : ''} · depuis {selectedOrigins}
						emplacement{selectedOrigins > 1 ? 's' : ''}
					</span>
				</p>
				<Button size="xs" color="alternative" onclick={() => (showSelection = !showSelection)}>
					{showSelection ? 'Masquer' : 'Voir'} la sélection
				</Button>
				<Button
					size="xs"
					color="alternative"
					onclick={() => {
						selection.clear();
						showSelection = false;
					}}
				>
					Tout désélectionner
				</Button>
				<!-- Étiquettes : une par produit sélectionné ; prix TTC pour ceux du magasin. -->
				<div class="ms-auto">
					<Button
						size="sm"
						color="alternative"
						href="/admin/products/labels?ids={selectedRows.map((r) => r.productId).join(',')}"
						target="_blank"
					>
						<PrinterOutline class="me-1.5 h-4 w-4" /> Étiquettes
					</Button>
				</div>
				<Button size="sm" onclick={() => startMove(selectedRows)}>
					Déplacer la sélection <ArrowRightOutline class="ms-1.5 h-4 w-4" />
				</Button>
			</div>
		</section>
	</div>
{/if}

<StockTransferDialog
	bind:open={moveOpen}
	lines={moveLines}
	locations={pickerLocations}
	{locationLabel}
	ondone={moved}
/>

{#snippet figure(label: string, value: string)}
	<div>
		<dt class="text-xs text-gray-500">{label}</dt>
		<dd class="text-lg font-semibold text-gray-900 tabular-nums">{value}</dd>
	</div>
{/snippet}

{#snippet tree(parentId: number | null)}
	<ul class="space-y-0.5">
		{#each childrenOf(parentId) as l (l.id)}
			{@const kids = childrenOf(l.id)}
			{@const isOpen = opened.has(l.id)}
			<li>
				<div class="flex items-center" style:padding-inline-start="{l.depth * 0.85}rem">
					{#if kids.length}
						<button
							type="button"
							onclick={() => toggle(l.id)}
							aria-label="{isOpen ? 'Replier' : 'Déplier'} {l.name}"
							aria-expanded={isOpen}
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-800"
						>
							{#if isOpen}
								<ChevronDownOutline class="h-3.5 w-3.5" />
							{:else}
								<ChevronRightOutline class="h-3.5 w-3.5" />
							{/if}
						</button>
					{:else}
						<span class="h-6 w-6 shrink-0" aria-hidden="true"></span>
					{/if}
					{@render treeLink(l, false)}
				</div>
				{#if isOpen && kids.length}
					{@render tree(l.id)}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet treeLink(l: Location, withPath: boolean)}
	{@const current = l.id === data.selectedId}
	{@const nodeUnits = totals.get(l.id) ?? 0}
	<a
		href="?id={l.id}"
		aria-current={current ? 'page' : undefined}
		class="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-sm {current
			? 'bg-primary-50 font-semibold text-primary-800'
			: 'text-gray-800 hover:bg-gray-100'} {l.isActive ? '' : 'line-through opacity-60'}"
	>
		<span class="min-w-0 flex-1">
			{#if withPath && l.depth > 0}
				<span class="block truncate text-xs font-normal text-gray-500">
					{l.path.slice(0, l.path.length - l.name.length - 3)}
				</span>
			{/if}
			<span class="block break-words">{l.name}</span>
		</span>
		{#if nodeUnits}
			<span class="shrink-0 text-xs font-normal text-gray-500 tabular-nums"
				>{formatNumber(nodeUnits)}</span
			>
		{/if}
		{#if l.code}
			<span
				class="shrink-0 cursor-help font-mono text-xs font-normal text-gray-500"
				title={l.description ?? l.path}>{l.code}</span
			>
		{/if}
	</a>
{/snippet}

<script lang="ts">
	import {
		PageHeader,
		FilterableTable,
		Pagination,
		StateBadge,
		listPageHref
	} from '$lib/components/admin';
	import { Button, Input, Label, Select } from 'flowbite-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type OrderRow = (typeof data.rows)[number];

	/**
	 * Critères de recherche à préserver lors du tri et de la pagination.
	 *
	 * Source unique : sans elle, trier une colonne repartait sur la liste
	 * complète en perdant la recherche en cours.
	 */
	const searchParams = $derived({
		...(data.search ? { q: data.search } : {}),
		...(data.dateFrom ? { from: data.dateFrom } : {}),
		...(data.dateTo ? { to: data.dateTo } : {}),
		...(data.minTotal ? { min: data.minTotal } : {}),
		...(data.maxTotal ? { max: data.maxTotal } : {}),
		...(data.shipped ? { shipped: data.shipped } : {}),
		...(data.stateIds.length ? { state: data.stateIds.map(String) } : {})
	});

	const tableParams = $derived({
		filters: data.filters,
		sort: data.sort,
		dir: data.dir,
		extra: searchParams
	});
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	/**
	 * Critères avancés, repliés par défaut.
	 *
	 * Le panneau s'ouvre d'emblée si l'URL en porte déjà : revenir sur une
	 * recherche partagée ne doit pas masquer les critères qui l'ont produite.
	 */
	let toggled = $state<boolean | null>(null);

	/** Nombre de critères actifs, hors recherche libre : sert le compteur. */
	const activeCount = $derived(
		(data.stateIds.length ? 1 : 0) +
			(data.dateFrom || data.dateTo ? 1 : 0) +
			(data.minTotal || data.maxTotal ? 1 : 0) +
			(data.shipped ? 1 : 0)
	);

	// `toggled` porte le choix explicite de l'opérateur ; sinon le panneau suit
	// l'URL, et une recherche partagée s'ouvre déjà dépliée.
	const advancedOpen = $derived(toggled ?? activeCount > 0);

	const hasAnyFilter = $derived(Boolean(data.search) || activeCount > 0);

	/**
	 * Message d'absence de résultat.
	 *
	 * Il rappelle ce qui a été cherché : « aucun résultat » seul laisse
	 * l'opérateur douter de la recherche autant que des données.
	 */
	const emptyMessage = $derived(
		data.search
			? `Aucune commande ne correspond à « ${data.search} »${activeCount > 0 ? ' avec les critères retenus' : ''}.`
			: activeCount > 0
				? 'Aucune commande ne correspond aux critères retenus.'
				: 'Aucune commande enregistrée.'
	);

	/** Conserve les critères courants dans les liens de pagination. */
	function pageHref(p: number) {
		const { state, ...single } = searchParams;
		const base = listPageHref(
			'/admin/orders',
			{ filters: data.filters, sort: data.sort, dir: data.dir, extra: single },
			p
		);
		// `listPageHref` ne porte qu'une valeur par clé : les états, multiples,
		// sont ajoutés à la suite.
		return (state ?? []).reduce<string>((href, id) => `${href}&state=${id}`, base);
	}
</script>

<svelte:head><title>Commandes · Administration</title></svelte:head>

<PageHeader
	title="Commandes"
	subtitle="{data.total} commande{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Commandes' }]}
/>

<!-- ================= Recherche ================= -->
<!--
	Une seule saisie interroge toutes les informations d'une commande — référence,
	client, suivi, adresse, article. Les 32 états ne sont plus affichés en
	permanence : ils tenaient six lignes à l'écran pour un usage occasionnel.
-->
<!--
	`action` explicite : sans lui, le navigateur repart de l'URL courante et
	conserve ses paramètres, si bien qu'une nouvelle recherche s'empilait sur la
	précédente au lieu de la remplacer. La pagination est volontairement absente
	des champs : toute recherche doit revenir à la première page.
-->
<form method="GET" action="/admin/orders" class="mb-5 space-y-3" data-sveltekit-keepfocus>
	<!-- Le tri en cours est reporté : rechercher ne doit pas réordonner la liste
	     dans le dos de l'opérateur. -->
	{#if data.sort}
		<input type="hidden" name="sort" value={data.sort} />
		<input type="hidden" name="dir" value={data.dir} />
	{/if}
	<div class="flex flex-wrap gap-2">
		<div class="min-w-64 flex-1">
			<Input
				name="q"
				value={data.search}
				placeholder="Référence, client, email, n° de suivi, ville, article…"
				aria-label="Rechercher une commande"
			/>
		</div>

		<Button type="submit" color="primary">Rechercher</Button>

		<Button type="button" color="alternative" onclick={() => (toggled = !advancedOpen)}>
			Critères
			{#if activeCount > 0}
				<span class="ms-2 rounded-full bg-primary-600 px-1.5 text-xs font-semibold text-white">
					{activeCount}
				</span>
			{/if}
		</Button>

		{#if hasAnyFilter}
			<Button color="alternative" href="/admin/orders">Réinitialiser</Button>
		{/if}
	</div>

	{#if advancedOpen}
		<div
			class="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
		>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<Label for="from" class="mb-1.5">Commandée après le</Label>
					<Input id="from" name="from" type="date" value={data.dateFrom} />
				</div>
				<div>
					<Label for="to" class="mb-1.5">Commandée avant le</Label>
					<Input id="to" name="to" type="date" value={data.dateTo} />
				</div>
				<div>
					<Label for="min" class="mb-1.5">Montant TTC min.</Label>
					<Input id="min" name="min" type="number" step="0.01" min="0" value={data.minTotal} />
				</div>
				<div>
					<Label for="max" class="mb-1.5">Montant TTC max.</Label>
					<Input id="max" name="max" type="number" step="0.01" min="0" value={data.maxTotal} />
				</div>
			</div>

			<div>
				<Label for="shipped" class="mb-1.5">Expédition</Label>
				<Select
					id="shipped"
					name="shipped"
					value={data.shipped}
					items={[
						{ value: '', name: 'Toutes' },
						{ value: '0', name: 'À expédier' },
						{ value: '1', name: 'Expédiées' }
					]}
				/>
			</div>

			<fieldset>
				<legend class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
					États {#if data.stateIds.length}({data.stateIds.length} sélectionné{data.stateIds.length >
						1
							? 's'
							: ''}){/if}
				</legend>
				<!-- Les états sont nombreux : cochés dans une zone défilante, ils
				     restent accessibles sans occuper l'écran en permanence. -->
				<div
					class="grid max-h-52 gap-1.5 overflow-y-auto rounded border border-gray-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-700 dark:bg-gray-900"
				>
					{#each data.states as st (st.id)}
						<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input
								type="checkbox"
								name="state"
								value={st.id}
								checked={data.stateIds.includes(st.id)}
								class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
							/>
							<span
								class="h-2.5 w-2.5 shrink-0 rounded-full"
								style="background-color: {st.color ?? '#6b7280'}"
								aria-hidden="true"
							></span>
							<span class="truncate">{st.label}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div>
				<Button type="submit" color="primary" size="sm">Appliquer les critères</Button>
			</div>
		</div>
	{/if}
</form>

{#snippet clearAction()}
	<Button color="alternative" size="sm" href="/admin/orders">Effacer la recherche</Button>
{/snippet}

{#snippet idCell(row: OrderRow)}
	<span class="text-gray-500">{row.id}</span>
{/snippet}

{#snippet refCell(row: OrderRow)}
	<span class="font-medium text-gray-900 dark:text-white">{row.reference}</span>
{/snippet}

{#snippet customerCell(row: OrderRow)}
	{#if row.customerFirstName || row.customerLastName}
		{row.customerFirstName}
		{row.customerLastName}
	{:else}
		<span class="text-gray-400">—</span>
	{/if}
{/snippet}

{#snippet stateCell(row: OrderRow)}
	{#if row.stateLabel}<StateBadge label={row.stateLabel} color={row.stateColor ?? '#6b7280'} />{/if}
{/snippet}

{#snippet totalCell(row: OrderRow)}
	<span class="font-medium text-gray-900 dark:text-white">{eur.format(Number(row.totalTtc))}</span>
{/snippet}

{#snippet dateCell(row: OrderRow)}
	{dateFmt.format(new Date(row.createdAt))}
{/snippet}

<FilterableTable
	rows={data.rows}
	basePath="/admin/orders"
	params={tableParams}
	columns={[
		{ key: 'id', label: 'ID', cell: idCell },
		{
			key: 'reference',
			label: 'Référence',
			cell: refCell,
			filterKey: 'reference',
			sortKey: 'reference'
		},
		{ key: 'customer', label: 'Client', cell: customerCell, filterKey: 'customer' },
		{ key: 'state', label: 'État', cell: stateCell },
		{ key: 'total', label: 'Total TTC', cell: totalCell, sortKey: 'totalTtc' },
		{ key: 'date', label: 'Date', cell: dateCell, sortKey: 'createdAt' }
	]}
	emptyMessage={emptyMessage}
	emptyAction={hasAnyFilter ? clearAction : undefined}
	rowHref={(row) => `/admin/orders/${row.id}`}
/>

<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hrefFor={pageHref} />

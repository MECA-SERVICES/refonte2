<script lang="ts">
	import {
		PageHeader,
		FilterableTable,
		Pagination,
		StateBadge,
		listPageHref,
		listFilterHref
	} from '$lib/components/admin';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type OrderRow = (typeof data.rows)[number];

	const tableParams = $derived({ filters: data.filters, sort: data.sort, dir: data.dir });
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	function filterByState(id: number | null) {
		// Chemin porteur d'une query string : `resolve()` n'accepte que des identifiants
		// de route littéraux, et l'application ne définit pas de `paths.base`.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(listFilterHref('/admin/orders', [['state', id]]));
	}

	function pageHref(p: number) {
		return listPageHref(
			'/admin/orders',
			{
				filters: data.filters,
				sort: data.sort,
				dir: data.dir,
				extra: data.stateId ? { state: String(data.stateId) } : undefined
			},
			p
		);
	}
</script>

<svelte:head><title>Commandes · Administration</title></svelte:head>

<PageHeader
	title="Commandes"
	subtitle="{data.total} commande{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Commandes' }]}
/>

<!-- Filtre rapide par état -->
<div class="mb-4 flex flex-wrap gap-2">
	<button
		type="button"
		onclick={() => filterByState(null)}
		class="rounded-full border px-3 py-1 text-sm {data.stateId === null
			? 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30'
			: 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}"
	>
		Toutes
	</button>
	{#each data.states as st (st.id)}
		<button
			type="button"
			onclick={() => filterByState(st.id)}
			class="rounded-full border px-3 py-1 text-sm {data.stateId === st.id
				? 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30'
				: 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}"
		>
			{st.label}
		</button>
	{/each}
</div>

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
	emptyMessage="Aucune commande trouvée."
	rowHref={(row) => `/admin/orders/${row.id}`}
/>

<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hrefFor={pageHref} />

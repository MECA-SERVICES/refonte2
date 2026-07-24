<script lang="ts">
	import {
		PageHeader,
		FilterableTable,
		Pagination,
		StateBadge,
		listPageHref
	} from '$lib/components/admin';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type OrderRow = (typeof data.rows)[number];

	const tableParams = $derived({ filters: data.filters, sort: data.sort, dir: data.dir });
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	function filterByState(id: number | null) {
		const params = new URLSearchParams();
		if (id) params.set('state', String(id));
		goto(`/admin/orders?${params.toString()}`);
	}

	function pageHref(p: number) {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(data.filters)) if (v) params.set(`f_${k}`, v);
		if (data.stateId) params.set('state', String(data.stateId));
		if (data.sort) {
			params.set('sort', data.sort);
			params.set('dir', data.dir);
		}
		params.set('page', String(p));
		return `/admin/orders?${params.toString()}`;
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

{#snippet refCell(row: OrderRow)}
	<span class="font-medium text-gray-900 dark:text-white">{row.reference}</span>
{/snippet}

{#snippet customerCell(row: OrderRow)}
	{row.customerFirstName} {row.customerLastName}
{/snippet}

{#snippet stateCell(row: OrderRow)}
	{#if row.stateLabel}<StateBadge label={row.stateLabel} color={row.stateColor ?? '#6b7280'} />{/if}
{/snippet}

{#snippet totalCell(row: OrderRow)}
	{eur.format(Number(row.totalTtc))}
{/snippet}

{#snippet dateCell(row: OrderRow)}
	{dateFmt.format(new Date(row.createdAt))}
{/snippet}

<FilterableTable
	rows={data.rows}
	basePath="/admin/orders"
	params={tableParams}
	columns={[
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

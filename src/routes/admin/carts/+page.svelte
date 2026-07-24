<script lang="ts">
	import { PageHeader, DataTable, Pagination } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type CartRow = (typeof data.rows)[number];
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head><title>Paniers · Administration</title></svelte:head>

<PageHeader
	title="Paniers"
	subtitle="{data.total} panier{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Paniers' }]}
/>

{#snippet idCell(row: CartRow)}
	<span class="text-gray-500">{row.id}</span>
{/snippet}

{#snippet customerCell(row: CartRow)}
	<span class="font-medium text-gray-900 dark:text-white">
		{row.customerFirstName}
		{row.customerLastName}
	</span>
	<span class="block text-xs text-gray-500 dark:text-gray-400">{row.customerEmail}</span>
{/snippet}

{#snippet activityCell(row: CartRow)}
	<span class="text-gray-600 dark:text-gray-300">
		{dateFmt.format(new Date(row.lastActivityAt))}
	</span>
{/snippet}

<DataTable
	rows={data.rows}
	columns={[
		{ key: 'id', label: 'ID', cell: idCell },
		{ key: 'customer', label: 'Client', cell: customerCell },
		{ key: 'itemCount', label: 'Articles' },
		{ key: 'activity', label: 'Dernière activité', cell: activityCell }
	]}
	emptyMessage="Aucun panier."
	rowHref={(row) => `/admin/carts/${row.id}`}
/>

<Pagination
	page={data.page}
	pageCount={data.pageCount}
	total={data.total}
	hrefFor={(p) => `/admin/carts?page=${p}`}
/>

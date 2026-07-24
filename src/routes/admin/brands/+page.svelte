<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		FilterableTable,
		Pagination,
		ActiveBadge,
		Thumbnail,
		listPageHref
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type BrandRow = (typeof data.rows)[number];

	const tableParams = $derived({ filters: data.filters, sort: data.sort, dir: data.dir });
</script>

<svelte:head><title>Marques · Administration</title></svelte:head>

<PageHeader
	title="Marques"
	subtitle="{data.total} marque{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Marques' }]}
>
	{#snippet actions()}
		<Button href="/admin/brands/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvelle marque
		</Button>
	{/snippet}
</PageHeader>

{#snippet idCell(row: BrandRow)}
	<span class="text-gray-500">{row.id}</span>
{/snippet}

{#snippet logoCell(row: BrandRow)}
	<Thumbnail src={row.logoUrl} alt={row.name} />
{/snippet}

{#snippet nameCell(row: BrandRow)}
	<span class="font-medium text-gray-900 dark:text-white">{row.name}</span>
{/snippet}

{#snippet slugCell(row: BrandRow)}
	<span class="text-xs text-gray-500">{row.slug}</span>
{/snippet}

{#snippet activeCell(row: BrandRow)}
	<ActiveBadge active={row.isActive} />
{/snippet}

<FilterableTable
	rows={data.rows}
	basePath="/admin/brands"
	params={tableParams}
	columns={[
		{ key: 'id', label: 'ID', cell: idCell },
		{ key: 'logo', label: 'Logo', cell: logoCell },
		{ key: 'name', label: 'Nom', cell: nameCell, filterKey: 'name', sortKey: 'name' },
		{ key: 'slug', label: 'Slug', cell: slugCell, filterKey: 'slug' },
		{ key: 'active', label: 'Statut', cell: activeCell }
	]}
	emptyMessage="Aucune marque trouvée."
	rowHref={(row) => `/admin/brands/${row.id}`}
/>

<Pagination
	page={data.page}
	pageCount={data.pageCount}
	total={data.total}
	hrefFor={(p) => listPageHref('/admin/brands', tableParams, p)}
/>

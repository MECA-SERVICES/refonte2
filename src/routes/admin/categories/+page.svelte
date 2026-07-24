<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		FilterableTable,
		Pagination,
		ActiveBadge,
		listPageHref
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type CategoryRow = (typeof data.rows)[number];

	const tableParams = $derived({ filters: data.filters, sort: data.sort, dir: data.dir });
</script>

<svelte:head><title>Catégories · Administration</title></svelte:head>

<PageHeader
	title="Catégories"
	subtitle="{data.total} catégorie{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Catégories' }]}
>
	{#snippet actions()}
		<Button href="/admin/categories/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvelle catégorie
		</Button>
	{/snippet}
</PageHeader>

{#snippet nameCell(row: CategoryRow)}
	<span class="font-medium text-gray-900 dark:text-white">{row.name}</span>
{/snippet}

{#snippet activeCell(row: CategoryRow)}
	<ActiveBadge active={row.isActive} />
{/snippet}

<FilterableTable
	rows={data.rows}
	basePath="/admin/categories"
	params={tableParams}
	columns={[
		{ key: 'name', label: 'Nom', cell: nameCell, filterKey: 'name', sortKey: 'name' },
		{ key: 'parentName', label: 'Parent' },
		{ key: 'slug', label: 'Slug', filterKey: 'slug' },
		{ key: 'position', label: 'Position', sortKey: 'position' },
		{ key: 'active', label: 'Statut', cell: activeCell }
	]}
	emptyMessage="Aucune catégorie trouvée."
	rowHref={(row) => `/admin/categories/${row.id}`}
/>

<Pagination
	page={data.page}
	pageCount={data.pageCount}
	total={data.total}
	hrefFor={(p) => listPageHref('/admin/categories', tableParams, p)}
/>

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

	type ProductRow = (typeof data.rows)[number];

	const tableParams = $derived({ filters: data.filters, sort: data.sort, dir: data.dir });

	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
</script>

<svelte:head><title>Produits · Administration</title></svelte:head>

<PageHeader
	title="Produits"
	subtitle="{data.total} produit{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Produits' }]}
>
	{#snippet actions()}
		<Button href="/admin/products/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouveau produit
		</Button>
	{/snippet}
</PageHeader>

{#snippet nameCell(row: ProductRow)}
	<span class="font-medium text-gray-900 dark:text-white">{row.name}</span>
{/snippet}

{#snippet priceCell(row: ProductRow)}
	{eur.format(Number(row.priceHt))}
{/snippet}

{#snippet brandCell(row: ProductRow)}
	{row.brandName ?? '—'}
{/snippet}

{#snippet activeCell(row: ProductRow)}
	<ActiveBadge active={row.isActive} />
{/snippet}

<FilterableTable
	rows={data.rows}
	basePath="/admin/products"
	params={tableParams}
	columns={[
		{ key: 'name', label: 'Nom', cell: nameCell, filterKey: 'name', sortKey: 'name' },
		{ key: 'reference', label: 'Référence', filterKey: 'reference', sortKey: 'reference' },
		{ key: 'brand', label: 'Marque', cell: brandCell },
		{ key: 'priceHt', label: 'Prix HT', cell: priceCell, sortKey: 'priceHt' },
		{ key: 'stock', label: 'Stock', sortKey: 'stock' },
		{ key: 'active', label: 'Statut', cell: activeCell }
	]}
	emptyMessage="Aucun produit trouvé."
	rowHref={(row) => `/admin/products/${row.id}`}
/>

<Pagination
	page={data.page}
	pageCount={data.pageCount}
	total={data.total}
	hrefFor={(p) => listPageHref('/admin/products', tableParams, p)}
/>

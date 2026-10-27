<script lang="ts">
	import {
		Button,
		Card,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { DownloadOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import { formatNumber, formatPrice } from '$lib/money';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const TYPE_LABELS: Record<string, string> = {
		machine: 'Machine',
		consumable: 'Consommable',
		part: 'Pièce'
	};

	const total = $derived(data.counts[data.scope]);
	const pageCount = $derived(Math.max(1, Math.ceil(total / data.perPage)));
	const pageHref = (page: number) => `?perimetre=${data.scope}${page > 1 ? `&page=${page}` : ''}`;
</script>

<svelte:head><title>Prix d'achat manquants · Administration</title></svelte:head>

<PageHeader
	title="Prix d'achat manquants"
	subtitle="Produits actifs sans prix d'achat HT : à compléter pour la marge et la valorisation du stock"
>
	{#snippet actions()}
		<Button
			href="/admin/purchase-prices/export?perimetre={data.scope}"
			size="sm"
			color="alternative"
		>
			<DownloadOutline class="me-2 h-4 w-4" /> Export CSV
		</Button>
	{/snippet}
</PageHeader>

<div class="mb-4 flex flex-wrap gap-2">
	{#each data.scopes as [value, label] (value)}
		<a
			href="?perimetre={value}"
			class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {data.scope ===
			value
				? 'border-primary-600 bg-primary-50 text-primary-700'
				: 'border-gray-200 text-gray-600 hover:border-gray-300'}"
		>
			{label}
			<span class="ms-1 text-xs text-gray-400">{formatNumber(data.counts[value])}</span>
		</a>
	{/each}
</div>

<Card class="max-w-none p-4">
	{#if data.rows.length === 0}
		<p class="py-8 text-center text-sm text-gray-500">
			Tous les produits de ce périmètre ont un prix d'achat.
		</p>
	{:else}
		<Table hoverable>
			<TableHead>
				<TableHeadCell>Référence</TableHeadCell>
				<TableHeadCell>Désignation</TableHeadCell>
				<TableHeadCell>Marque</TableHeadCell>
				<TableHeadCell>Type</TableHeadCell>
				<TableHeadCell class="text-right">Stock</TableHeadCell>
				<TableHeadCell class="text-right">Prix de vente HT</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each data.rows as row (row.id)}
					<TableBodyRow>
						<TableBodyCell class="whitespace-nowrap">
							{row.reference}
							{#if row.supplierReference}
								<span class="block text-xs text-gray-500">{row.supplierReference}</span>
							{/if}
						</TableBodyCell>
						<TableBodyCell class="max-w-md truncate">
							<a
								href="/admin/products/{row.id}"
								class="font-medium text-primary-700 hover:underline"
								title={row.name}
							>
								{row.name}
							</a>
						</TableBodyCell>
						<TableBodyCell>{row.brand ?? '—'}</TableBodyCell>
						<TableBodyCell>{TYPE_LABELS[row.type] ?? row.type}</TableBodyCell>
						<TableBodyCell class="text-right tabular-nums">{row.stock}</TableBodyCell>
						<TableBodyCell class="text-right tabular-nums">{formatPrice(row.priceHt)}</TableBodyCell
						>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>

		<Pagination page={data.page} {pageCount} {total} hrefFor={pageHref} />
	{/if}
</Card>

<script lang="ts">
	import {
		Card,
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell
	} from 'flowbite-svelte';
	import { PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const c = $derived(data.cart);
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
</script>

<svelte:head><title>Panier #{c.id} · Administration</title></svelte:head>

<PageHeader
	title="Panier #{c.id}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Paniers', href: '/admin/carts' },
		{ label: `#${c.id}` }
	]}
/>

<Card class="mb-6 p-6">
	<h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Client</h2>
	{#if c.customer}
		<p class="font-medium text-gray-900 dark:text-white">
			{c.customer.firstName}
			{c.customer.lastName}
		</p>
		<p class="text-sm text-gray-500 dark:text-gray-400">{c.customer.email}</p>
	{/if}
</Card>

<Card class="max-w-none p-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
		Articles ({c.items.length})
	</h2>
	{#if c.items.length > 0}
		<Table>
			<TableHead>
				<TableHeadCell>Produit</TableHeadCell>
				<TableHeadCell>Référence</TableHeadCell>
				<TableHeadCell>Prix HT</TableHeadCell>
				<TableHeadCell>Qté</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each c.items as item (item.id)}
					<TableBodyRow>
						<TableBodyCell>{item.productName ?? 'Produit supprimé'}</TableBodyCell>
						<TableBodyCell>{item.productReference ?? '—'}</TableBodyCell>
						<TableBodyCell>{item.priceHt ? eur.format(Number(item.priceHt)) : '—'}</TableBodyCell>
						<TableBodyCell>{item.quantity}</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	{:else}
		<p class="text-sm text-gray-500 dark:text-gray-400">Panier vide.</p>
	{/if}
</Card>

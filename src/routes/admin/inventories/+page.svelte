<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { formatNumber, formatPrice } from '$lib/money';
	import { PageHeader, StateBadge } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Inventaires annuels, repris du module Dolibarr « UTILE » : une campagne par
	 * année, comptée emplacement par emplacement, puis validée.
	 */

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
	const open = $derived(data.inventories.filter((i) => i.status === 'open'));
</script>

<svelte:head><title>Inventaires · Administration</title></svelte:head>

<PageHeader
	title="Inventaires"
	subtitle="Comptage annuel du stock, emplacement par emplacement, comme dans Dolibarr"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Inventaires' }]}
/>

<Card class="mb-6 max-w-none p-4">
	<form
		method="POST"
		action="?/create"
		use:enhance
		data-feedback="errors"
		class="flex flex-wrap items-end gap-3"
	>
		<div class="min-w-64 flex-1">
			<label for="inventory-name" class="mb-2 block text-sm font-semibold text-gray-900">
				Nouvel inventaire
			</label>
			<Input
				id="inventory-name"
				name="name"
				required
				value="INVENTAIRE {new Date().getFullYear()}"
			/>
		</div>
		<Button type="submit"><PlusOutline class="me-2 h-4 w-4" /> Commencer le comptage</Button>
	</form>
	{#if open.length}
		<p class="mt-3 text-sm text-yellow-800">
			{open.length} inventaire{open.length > 1 ? 's' : ''} en cours : finissez-le avant d'en commencer
			un autre, sauf comptage à part.
		</p>
	{/if}
</Card>

<Card class="max-w-none p-0">
	<table class="w-full text-sm">
		<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 text-start">Inventaire</th>
				<th scope="col" class="px-4 py-3 text-start">État</th>
				<th scope="col" class="px-4 py-3 text-end">Références</th>
				<th scope="col" class="px-4 py-3 text-end">Unités</th>
				<th scope="col" class="px-4 py-3 text-end">Valeur d'achat HT</th>
				<th scope="col" class="px-4 py-3 text-start">Date</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data.inventories as inv (inv.id)}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-3">
						<a
							href="/admin/inventories/{inv.id}"
							class="font-medium text-primary-700 hover:underline">{inv.name}</a
						>
						{#if inv.legacyDoliId}<span class="ms-2 text-xs text-gray-500">repris de Dolibarr</span
							>{/if}
					</td>
					<td class="px-4 py-3">
						<StateBadge
							color={inv.status === 'open' ? 'yellow' : 'green'}
							label={inv.status === 'open' ? 'En cours' : 'Validé'}
						/>
					</td>
					<td class="px-4 py-3 text-end tabular-nums">{formatNumber(inv.products)}</td>
					<td class="px-4 py-3 text-end tabular-nums">{formatNumber(inv.units)}</td>
					<td class="px-4 py-3 text-end tabular-nums">{formatPrice(inv.value)}</td>
					<td class="px-4 py-3 text-gray-600">
						{dateFmt.format(new Date(inv.validatedAt ?? inv.createdAt))}
					</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Aucun inventaire.</td></tr>
			{/each}
		</tbody>
	</table>
</Card>

<script lang="ts">
	import { Button, Card, Input } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { formatNumber } from '$lib/money';
	import { ActiveBadge, PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/** Fournisseurs (CDC 11) : les actifs d'abord, avec le nombre de produits approvisionnés. */

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Fournisseurs · Administration</title></svelte:head>

<PageHeader
	title="Fournisseurs"
	subtitle="{formatNumber(data.suppliers.length)} fournisseur{data.suppliers.length > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Fournisseurs' }]}
>
	{#snippet actions()}
		<Button href="/admin/suppliers/new"
			><PlusOutline class="me-2 h-4 w-4" /> Nouveau fournisseur</Button
		>
	{/snippet}
</PageHeader>

<Card class="mb-4 max-w-none p-4">
	<form method="GET" class="flex gap-2">
		<Input
			type="search"
			name="q"
			value={data.q}
			placeholder="Nom, code, e-mail ou ville"
			aria-label="Chercher un fournisseur"
			class="w-72"
		/>
		<Button type="submit" color="alternative">Chercher</Button>
	</form>
</Card>

<Card class="max-w-none p-0">
	<table class="w-full text-sm">
		<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 text-start">Fournisseur</th>
				<th scope="col" class="px-4 py-3 text-start">Contact</th>
				<th scope="col" class="px-4 py-3 text-start">Ville</th>
				<th scope="col" class="px-4 py-3 text-end">Produits</th>
				<th scope="col" class="px-4 py-3 text-end">Dont principal</th>
				<th scope="col" class="px-4 py-3 text-start">Statut</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data.suppliers as s (s.id)}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-2.5">
						<a href="/admin/suppliers/{s.id}" class="font-medium text-primary-700 hover:underline"
							>{s.name}</a
						>
						{#if s.code}<span class="block text-xs text-gray-500">{s.code}</span>{/if}
					</td>
					<td class="px-4 py-2.5 text-gray-600">{[s.email, s.phone].filter(Boolean).join(' · ')}</td
					>
					<td class="px-4 py-2.5 text-gray-600">{s.city ?? ''}</td>
					<td class="px-4 py-2.5 text-end tabular-nums">{formatNumber(s.linked)}</td>
					<td class="px-4 py-2.5 text-end tabular-nums">{formatNumber(s.main)}</td>
					<td class="px-4 py-2.5"><ActiveBadge active={s.isActive} /></td>
				</tr>
			{:else}
				<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Aucun fournisseur.</td></tr>
			{/each}
		</tbody>
	</table>
</Card>

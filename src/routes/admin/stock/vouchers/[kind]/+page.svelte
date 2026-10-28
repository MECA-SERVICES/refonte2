<script lang="ts">
	import { Button, Card, Input } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { formatNumber } from '$lib/money';
	import { PageHeader, StateBadge } from '$lib/components/admin';
	import { reasonLabel, VOUCHER_KINDS } from '$lib/stock-vouchers';
	import type { PageProps } from './$types';

	/** Bons d'entrée ou de sortie, comme les listes de BL et de bons du module UTILE. */

	let { data }: PageProps = $props();

	const meta = $derived(VOUCHER_KINDS[data.slug]);
	const isReceipt = $derived(meta.kind === 'receipt');
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head><title>{meta.title} · Administration</title></svelte:head>

<PageHeader
	title={meta.title}
	subtitle={meta.subtitle}
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: meta.title }]}
>
	{#snippet actions()}
		<Button href="/admin/stock/vouchers/{data.slug}/new">
			<PlusOutline class="me-2 h-4 w-4" />
			{meta.create}
		</Button>
	{/snippet}
</PageHeader>

<Card class="mb-4 max-w-none p-4">
	<form method="GET" class="flex gap-2">
		<Input
			type="search"
			name="q"
			value={data.q}
			placeholder={isReceipt
				? 'N° de BL, fournisseur ou référence produit'
				: 'N° de bon ou référence produit'}
			aria-label="Chercher un bon"
			class="flex-1"
		/>
		<Button type="submit" color="alternative">Chercher</Button>
	</form>
	<p class="mt-2 text-xs text-gray-500">
		{data.q ? `Résultats pour « ${data.q} » (200 au plus).` : 'Bons des 30 derniers jours.'}
	</p>
</Card>

<Card class="max-w-none p-0">
	<table class="w-full text-sm">
		<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 text-start">Date</th>
				<th scope="col" class="px-4 py-3 text-start">{isReceipt ? 'N° de BL' : 'N° de bon'}</th>
				<th scope="col" class="px-4 py-3 text-start">{isReceipt ? 'Fournisseur' : 'Motif'}</th>
				<th scope="col" class="px-4 py-3 text-end">Lignes</th>
				<th scope="col" class="px-4 py-3 text-end">Pièces</th>
				<th scope="col" class="px-4 py-3 text-start">État</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data.vouchers as v (v.id)}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-2.5 whitespace-nowrap">
						<a
							href="/admin/stock/vouchers/{data.slug}/{v.id}"
							class="text-primary-700 hover:underline"
						>
							{dateFmt.format(new Date(v.createdAt))}
						</a>
					</td>
					<td class="px-4 py-2.5 font-mono text-xs">{v.reference ?? '—'}</td>
					<td class="px-4 py-2.5">{isReceipt ? (v.supplier ?? '—') : reasonLabel(v.reason)}</td>
					<td class="px-4 py-2.5 text-end tabular-nums">{formatNumber(v.lines)}</td>
					<td class="px-4 py-2.5 text-end tabular-nums">{formatNumber(v.units)}</td>
					<td class="px-4 py-2.5">
						{#if v.cancelledAt}
							<StateBadge color="gray" label="Annulé" />
						{:else if v.legacyDoliKey}
							<span class="text-xs text-gray-500">Dolibarr</span>
						{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Aucun bon.</td></tr>
			{/each}
		</tbody>
	</table>
</Card>

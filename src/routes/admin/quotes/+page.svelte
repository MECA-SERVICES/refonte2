<script lang="ts">
	import { Button, Card, Input } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { formatNumber, formatPrice } from '$lib/money';
	import { QUOTE_STATUS } from '$lib/quotes';
	import { PageHeader, StatCard, StateBadge, listFilterHref } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/** Devis (CDC 23), comme la liste des propositions commerciales de Dolibarr. */

	let { data }: PageProps = $props();

	const TABS = [
		{ value: 'all', label: 'Tous' },
		{ value: 'draft', label: 'Brouillons' },
		{ value: 'open', label: 'En cours' },
		{ value: 'accepted', label: 'À facturer' },
		{ value: 'invoiced', label: 'Facturés' },
		{ value: 'lost', label: 'Refusés ou expirés' }
	] as const;
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });
</script>

<svelte:head><title>Devis · Administration</title></svelte:head>

<PageHeader
	title="Devis"
	subtitle="Propositions chiffrées, transformées en facture une fois acceptées"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Devis' }]}
>
	{#snippet actions()}
		<Button href="/admin/quotes/new"><PlusOutline class="me-2 h-4 w-4" /> Nouveau devis</Button>
	{/snippet}
</PageHeader>

<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<StatCard
		label="Devis en cours"
		value={data.summary.openCount}
		href={listFilterHref('/admin/quotes', [['f', 'open']])}
	/>
	<StatCard label="Montant en cours" value={formatPrice(data.summary.openTotal)} />
	<StatCard
		label="Acceptés à facturer"
		value={data.summary.acceptedCount}
		href={listFilterHref('/admin/quotes', [['f', 'accepted']])}
	/>
	<StatCard label="Montant à facturer" value={formatPrice(data.summary.acceptedTotal)} />
</div>

<Card class="mb-4 max-w-none p-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<nav class="flex flex-wrap gap-1.5" aria-label="Filtrer les devis">
			{#each TABS as tab (tab.value)}
				<Button
					size="xs"
					color={data.filter === tab.value ? 'primary' : 'alternative'}
					href={listFilterHref('/admin/quotes', [
						['f', tab.value === 'all' ? '' : tab.value],
						['q', data.q]
					])}
				>
					{tab.label}
				</Button>
			{/each}
		</nav>
		<form method="GET" class="flex gap-2">
			{#if data.filter !== 'all'}<input type="hidden" name="f" value={data.filter} />{/if}
			<Input
				type="search"
				name="q"
				value={data.q}
				placeholder="N° de devis ou client"
				aria-label="Chercher un devis"
				class="w-64"
			/>
			<Button type="submit" color="alternative">Chercher</Button>
		</form>
	</div>
</Card>

<Card class="max-w-none p-0">
	<table class="w-full text-sm">
		<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 text-start">N°</th>
				<th scope="col" class="px-4 py-3 text-start">Date</th>
				<th scope="col" class="px-4 py-3 text-start">Client</th>
				<th scope="col" class="px-4 py-3 text-start">Valable jusqu'au</th>
				<th scope="col" class="px-4 py-3 text-end">Total TTC</th>
				<th scope="col" class="px-4 py-3 text-start">État</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data.quotes as q (q.id)}
				{@const status = QUOTE_STATUS[q.displayStatus]}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-2.5">
						<a
							href="/admin/quotes/{q.id}"
							class="font-mono text-xs font-semibold text-primary-700 hover:underline"
						>
							{q.number ?? `Brouillon n° ${q.id}`}
						</a>
					</td>
					<td class="px-4 py-2.5 text-gray-600"
						>{dateFmt.format(new Date(q.issuedOn ?? q.createdAt))}</td
					>
					<td class="px-4 py-2.5">
						<a href="/admin/customers/{q.customerId}" class="hover:underline"
							>{q.customerName || '—'}</a
						>
					</td>
					<td class="px-4 py-2.5 text-gray-600"
						>{q.validUntil ? dateFmt.format(new Date(q.validUntil)) : ''}</td
					>
					<td class="px-4 py-2.5 text-end tabular-nums">{formatPrice(q.totalTtc)}</td>
					<td class="px-4 py-2.5"><StateBadge color={status.color} label={status.label} /></td>
				</tr>
			{:else}
				<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Aucun devis.</td></tr>
			{/each}
		</tbody>
	</table>
	{#if data.quotes.length >= 200}
		<p class="p-3 text-center text-xs text-gray-500">200 premiers : affinez la recherche.</p>
	{/if}
</Card>
<p class="mt-2 text-xs text-gray-500">{formatNumber(data.quotes.length)} devis affiché(s).</p>

<script lang="ts">
	import { Button, Card, Input } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { formatNumber, formatPrice } from '$lib/money';
	import { COUNTER_STATUS, remainingDue } from '$lib/counter-invoices';
	import { PageHeader, StatCard, StateBadge, listFilterHref } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/** Factures comptoir et avoirs, comme la liste des factures de Dolibarr. */

	let { data }: PageProps = $props();

	const TABS = [
		{ value: 'all', label: 'Toutes' },
		{ value: 'draft', label: 'Brouillons' },
		{ value: 'unpaid', label: 'Impayées' },
		{ value: 'paid', label: 'Payées' },
		{ value: 'credit_note', label: 'Avoirs' }
	] as const;
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });
</script>

<svelte:head><title>Factures comptoir · Administration</title></svelte:head>

<PageHeader
	title="Factures comptoir"
	subtitle="Factures et avoirs saisis au comptoir ou depuis un ordre de réparation"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Factures comptoir' }]}
>
	{#snippet actions()}
		<Button href="/admin/invoices/new"><PlusOutline class="me-2 h-4 w-4" /> Nouvelle facture</Button
		>
	{/snippet}
</PageHeader>

<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
	<StatCard
		label="Factures impayées"
		value={data.unpaid.count}
		href={listFilterHref('/admin/invoices', [['f', 'unpaid']])}
	/>
	<StatCard label="Reste à encaisser" value={formatPrice(data.unpaid.due)} />
</div>

<Card class="mb-4 max-w-none p-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<nav class="flex flex-wrap gap-1.5" aria-label="Filtrer les factures">
			{#each TABS as tab (tab.value)}
				<Button
					size="xs"
					color={data.filter === tab.value ? 'primary' : 'alternative'}
					href={listFilterHref('/admin/invoices', [
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
				placeholder="N° de facture ou client"
				aria-label="Chercher une facture"
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
				<th scope="col" class="px-4 py-3 text-end">Total TTC</th>
				<th scope="col" class="px-4 py-3 text-end">Reste dû</th>
				<th scope="col" class="px-4 py-3 text-start">État</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data.invoices as inv (inv.id)}
				{@const status = COUNTER_STATUS[inv.status]}
				{@const due =
					inv.kind === 'invoice' && inv.status === 'validated'
						? remainingDue(Number(inv.totalTtc), Number(inv.paid), Number(inv.credited))
						: 0}
				<tr class="hover:bg-gray-50">
					<td class="px-4 py-2.5">
						<a
							href="/admin/invoices/{inv.id}"
							class="font-mono text-xs font-semibold text-primary-700 hover:underline"
						>
							{inv.number ?? `Brouillon n° ${inv.id}`}
						</a>
						{#if inv.kind === 'credit_note'}<StateBadge
								color="purple"
								label="Avoir"
								class="ms-1"
							/>{/if}
					</td>
					<td class="px-4 py-2.5 text-gray-600"
						>{dateFmt.format(new Date(inv.issuedOn ?? inv.createdAt))}</td
					>
					<td class="px-4 py-2.5">
						<a href="/admin/customers/{inv.customerId}" class="hover:underline"
							>{inv.customerName || '—'}</a
						>
					</td>
					<td class="px-4 py-2.5 text-end tabular-nums">{formatPrice(inv.totalTtc)}</td>
					<td class="px-4 py-2.5 text-end font-semibold tabular-nums"
						>{due > 0 ? formatPrice(due) : ''}</td
					>
					<td class="px-4 py-2.5"><StateBadge color={status.color} label={status.label} /></td>
				</tr>
			{:else}
				<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Aucune facture.</td></tr>
			{/each}
		</tbody>
	</table>
	{#if data.invoices.length >= 200}
		<p class="p-3 text-center text-xs text-gray-500">200 premières : affinez la recherche.</p>
	{/if}
</Card>
<p class="mt-2 text-xs text-gray-500">
	{formatNumber(data.invoices.length)} facture(s) affichée(s).
</p>

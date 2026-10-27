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
	import { PlusOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import StateBadge from '$lib/components/admin/StateBadge.svelte';
	import { formatPrice } from '$lib/money';
	import { REMITTANCE_KIND_LABELS, remittanceKinds } from '$lib/settlements';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });
</script>

<svelte:head><title>Remises en banque · Administration</title></svelte:head>

<PageHeader
	title="Remises en banque"
	subtitle="Bordereaux de remise des chèques et des espèces encaissés au comptoir"
/>

<div class="mb-6 grid gap-4 sm:grid-cols-2">
	{#each remittanceKinds as kind (kind)}
		{@const pending = data.pending[kind]}
		<Card class="max-w-none p-4">
			<p class="text-sm font-semibold text-gray-900">
				{REMITTANCE_KIND_LABELS[kind]} en caisse
			</p>
			<p class="mt-1 text-2xl font-semibold text-gray-900">
				{formatPrice(pending.total)}
			</p>
			<p class="text-xs text-gray-500">
				{pending.count}
				{pending.count > 1 ? 'règlements' : 'règlement'} à remettre en banque
			</p>
			<Button
				href="/admin/remittances/new?type={kind}"
				size="sm"
				class="mt-3 w-fit"
				disabled={pending.count === 0}
			>
				<PlusOutline class="me-2 h-4 w-4" />
				Bordereau {kind === 'cheque' ? 'de chèques' : 'd’espèces'}
			</Button>
		</Card>
	{/each}
</div>

<Card class="max-w-none p-4">
	{#if data.remittances.length === 0}
		<p class="py-8 text-center text-sm text-gray-500">Aucun bordereau de remise pour l'instant.</p>
	{:else}
		<Table hoverable>
			<TableHead>
				<TableHeadCell>Référence</TableHeadCell>
				<TableHeadCell>Nature</TableHeadCell>
				<TableHeadCell>Date de remise</TableHeadCell>
				<TableHeadCell>Compte</TableHeadCell>
				<TableHeadCell class="text-right">Nombre</TableHeadCell>
				<TableHeadCell class="text-right">Total</TableHeadCell>
				<TableHeadCell>Statut</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each data.remittances as r (r.id)}
					<TableBodyRow>
						<TableBodyCell>
							<a
								href="/admin/remittances/{r.id}"
								class="font-medium text-primary-700 hover:underline"
							>
								{r.reference}
							</a>
						</TableBodyCell>
						<TableBodyCell>{REMITTANCE_KIND_LABELS[r.kind]}</TableBodyCell>
						<TableBodyCell>{date.format(new Date(r.depositedOn))}</TableBodyCell>
						<TableBodyCell>{r.bankAccount}</TableBodyCell>
						<TableBodyCell class="text-right">{r.settlementCount}</TableBodyCell>
						<TableBodyCell class="text-right">{formatPrice(r.total)}</TableBodyCell>
						<TableBodyCell><StateBadge color="green" label="Validé" /></TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	{/if}
</Card>

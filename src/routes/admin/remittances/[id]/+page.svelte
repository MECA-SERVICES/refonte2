<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
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
	import { FilePdfOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import { ConfirmDialog, PageHeader, StateBadge } from '$lib/components/admin';
	import { formatPrice } from '$lib/money';
	import { REMITTANCE_KIND_LABELS, payerName } from '$lib/settlements';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const r = $derived(data.remittance);
	const isCheque = $derived(r.kind === 'cheque');
	const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{r.reference} · Remises en banque</title></svelte:head>

<PageHeader
	title={r.reference}
	subtitle="Bordereau de remise — {REMITTANCE_KIND_LABELS[r.kind].toLowerCase()}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Remises en banque', href: '/admin/remittances' },
		{ label: r.reference }
	]}
>
	{#snippet actions()}
		<Button href="/admin/remittances/{r.id}/pdf" target="_blank" rel="noopener" size="sm">
			<FilePdfOutline class="me-2 h-4 w-4" /> Bordereau PDF
		</Button>
		{#if !r.legacyDoliId}
			<Button color="alternative" size="sm" onclick={() => (confirmOpen = true)}>
				<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<Card class="mb-6 max-w-none p-6">
	<dl class="grid gap-4 text-sm sm:grid-cols-5">
		<div>
			<dt class="text-gray-500">Compte bancaire</dt>
			<dd class="font-medium text-gray-900">{r.bankAccount}</dd>
		</div>
		<div>
			<dt class="text-gray-500">Date de remise</dt>
			<dd class="font-medium text-gray-900">
				{date.format(new Date(r.depositedOn))}
			</dd>
		</div>
		<div>
			<dt class="text-gray-500">
				{isCheque ? 'Nombre de chèques' : 'Nombre de règlements'}
			</dt>
			<dd class="font-medium text-gray-900">{r.settlementCount}</dd>
		</div>
		<div>
			<dt class="text-gray-500">Total</dt>
			<dd class="font-semibold text-gray-900">{formatPrice(r.total)}</dd>
		</div>
		<div>
			<dt class="text-gray-500">Statut</dt>
			<dd class="flex flex-wrap gap-1">
				<StateBadge color="green" label="Validé" />
				{#if r.legacyDoliId}<StateBadge label="Repris de Dolibarr" />{/if}
			</dd>
		</div>
	</dl>
</Card>

<Card class="max-w-none p-4">
	<Table>
		<TableHead>
			<TableHeadCell>Reçu le</TableHeadCell>
			{#if isCheque}
				<TableHeadCell>N° de chèque</TableHeadCell>
				<TableHeadCell>Émetteur</TableHeadCell>
				<TableHeadCell>Banque</TableHeadCell>
			{:else}
				<TableHeadCell>Client</TableHeadCell>
			{/if}
			<TableHeadCell>Règlement</TableHeadCell>
			<TableHeadCell class="text-right">Montant</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each r.lines as line (line.id)}
				<TableBodyRow>
					<TableBodyCell>{date.format(new Date(line.receivedOn))}</TableBodyCell>
					{#if isCheque}
						<TableBodyCell>{line.chequeNumber ?? '—'}</TableBodyCell>
						<TableBodyCell>{payerName(line)}</TableBodyCell>
						<TableBodyCell>{line.chequeBank ?? '—'}</TableBodyCell>
					{:else}
						<TableBodyCell>{payerName(line)}</TableBodyCell>
					{/if}
					<TableBodyCell>
						<span class="block">{line.reference}</span>
						{#if line.repairOrderId}
							<a
								href="/admin/repairs/{line.repairOrderId}"
								class="text-xs text-primary-700 hover:underline"
							>
								{line.repairReference}
							</a>
						{:else if line.counterInvoiceId}
							<a
								href="/admin/invoices/{line.counterInvoiceId}"
								class="text-xs text-primary-700 hover:underline"
							>
								{line.invoiceNumber ?? 'Facture brouillon'}
							</a>
						{/if}
					</TableBodyCell>
					<TableBodyCell class="text-right">{formatPrice(line.amount)}</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
</Card>

<form
	method="POST"
	action="?/delete"
	bind:this={deleteForm}
	use:enhance
	data-success="Bordereau supprimé : ses règlements sont de nouveau en caisse."
	class="hidden"
></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le bordereau"
	message="Le bordereau {r.reference} sera supprimé et ses règlements retourneront en caisse, prêts pour un nouveau bordereau. Les règlements eux-mêmes ne sont pas supprimés."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>

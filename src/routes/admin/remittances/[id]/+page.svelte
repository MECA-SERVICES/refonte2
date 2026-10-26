<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import {
		Badge,
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
	import { ConfirmDialog, PageHeader } from '$lib/components/admin';
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
		<Button color="alternative" size="sm" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<Card class="mb-6 max-w-none p-6">
	<dl class="grid gap-4 text-sm sm:grid-cols-5">
		<div>
			<dt class="text-gray-500 dark:text-gray-400">Compte bancaire</dt>
			<dd class="font-medium text-gray-900 dark:text-white">{r.bankAccount}</dd>
		</div>
		<div>
			<dt class="text-gray-500 dark:text-gray-400">Date de remise</dt>
			<dd class="font-medium text-gray-900 dark:text-white">
				{date.format(new Date(r.depositedOn))}
			</dd>
		</div>
		<div>
			<dt class="text-gray-500 dark:text-gray-400">
				{isCheque ? 'Nombre de chèques' : 'Nombre de règlements'}
			</dt>
			<dd class="font-medium text-gray-900 dark:text-white">{r.settlementCount}</dd>
		</div>
		<div>
			<dt class="text-gray-500 dark:text-gray-400">Total</dt>
			<dd class="font-semibold text-gray-900 dark:text-white">{formatPrice(r.total)}</dd>
		</div>
		<div>
			<dt class="text-gray-500 dark:text-gray-400">Statut</dt>
			<dd><Badge color="green">Validé</Badge></dd>
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
								class="text-xs text-primary-700 hover:underline dark:text-primary-400"
							>
								{line.repairReference}
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

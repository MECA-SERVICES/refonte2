<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import {
		Alert,
		Button,
		Card,
		Checkbox,
		Input,
		Label,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import { formatPrice } from '$lib/money';
	import { DEFAULT_BANK_ACCOUNT, REMITTANCE_KIND_LABELS, payerName } from '$lib/settlements';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const isCheque = $derived(data.kind === 'cheque');
	const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });
	/** Date du jour au format des champs `date` (AAAA-MM-JJ). */
	const today = new Date().toLocaleDateString('sv-SE');

	/** Règlements décochés ; tout est coché par défaut, comme un dépôt complet. */
	let excluded = $state<number[]>([]);
	const selected = $derived(data.settlements.filter((s) => !excluded.includes(s.id)));
	const selectedTotal = $derived(selected.reduce((sum, s) => sum + Number(s.amount), 0));

	function toggle(id: number, checked: boolean) {
		excluded = checked ? excluded.filter((x) => x !== id) : [...excluded, id];
	}
</script>

<svelte:head><title>Nouveau bordereau · Remises en banque</title></svelte:head>

<PageHeader
	title="Bordereau de remise — {REMITTANCE_KIND_LABELS[data.kind].toLowerCase()}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Remises en banque', href: '/admin/remittances' },
		{ label: 'Nouveau bordereau' }
	]}
/>

<div class="mb-4 flex gap-2">
	<Button
		href="?type=cheque"
		size="sm"
		color={isCheque ? 'primary' : 'alternative'}
		onclick={() => (excluded = [])}
	>
		Chèques
	</Button>
	<Button
		href="?type=cash"
		size="sm"
		color={isCheque ? 'alternative' : 'primary'}
		onclick={() => (excluded = [])}
	>
		Espèces
	</Button>
</div>

<form method="POST" use:enhance class="space-y-6">
	<input type="hidden" name="kind" value={data.kind} />

	{#if form?.message}
		<Alert color="red">{form.message}</Alert>
	{/if}

	<Card class="max-w-none p-6">
		<h2 class="mb-1 text-lg font-semibold text-gray-900">
			{isCheque ? 'Chèques' : 'Espèces'} en caisse
		</h2>
		<p class="mb-4 text-xs text-gray-500">
			Décochez ce qui ne part pas à la banque cette fois-ci : il restera en caisse pour le prochain
			bordereau.
		</p>

		{#if data.settlements.length === 0}
			<p class="py-6 text-center text-sm text-gray-500">
				Aucun règlement {isCheque ? 'par chèque' : 'en espèces'} en attente de remise.
			</p>
		{:else}
			<Table>
				<TableHead>
					<TableHeadCell class="w-8"><span class="sr-only">Inclure</span></TableHeadCell>
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
					{#each data.settlements as s (s.id)}
						<TableBodyRow>
							<TableBodyCell>
								<Checkbox
									name="settlementId"
									value={String(s.id)}
									checked={!excluded.includes(s.id)}
									onchange={(e) => toggle(s.id, e.currentTarget.checked)}
									aria-label="Inclure {s.reference}"
								/>
							</TableBodyCell>
							<TableBodyCell>{date.format(new Date(s.receivedOn))}</TableBodyCell>
							{#if isCheque}
								<TableBodyCell>{s.chequeNumber ?? '—'}</TableBodyCell>
								<TableBodyCell>{payerName(s)}</TableBodyCell>
								<TableBodyCell>{s.chequeBank ?? '—'}</TableBodyCell>
							{:else}
								<TableBodyCell>{payerName(s)}</TableBodyCell>
							{/if}
							<TableBodyCell>
								<span class="block">{s.reference}</span>
								{#if s.repairOrderId}
									<a
										href="/admin/repairs/{s.repairOrderId}"
										class="text-xs text-primary-700 hover:underline"
									>
										{s.repairReference}
									</a>
								{:else if s.counterInvoiceId}
									<a
										href="/admin/invoices/{s.counterInvoiceId}"
										class="text-xs text-primary-700 hover:underline"
									>
										{s.invoiceNumber ?? 'Facture brouillon'}
									</a>
								{/if}
							</TableBodyCell>
							<TableBodyCell class="text-right">{formatPrice(s.amount)}</TableBodyCell>
						</TableBodyRow>
					{/each}
				</TableBody>
			</Table>
		{/if}
	</Card>

	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Remise</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="depositedOn" class="mb-2">Date de remise</Label>
				<Input id="depositedOn" name="depositedOn" type="date" value={today} required />
			</div>
			<div>
				<Label for="bankAccount" class="mb-2">Compte bancaire crédité</Label>
				<Input id="bankAccount" name="bankAccount" value={DEFAULT_BANK_ACCOUNT} required />
			</div>
		</div>
		<p class="mt-4 text-sm text-gray-700">
			<strong>{selected.length}</strong>
			{selected.length > 1 ? 'règlements' : 'règlement'} pour
			<strong>{formatPrice(selectedTotal)}</strong>
		</p>
	</Card>

	<div class="flex justify-end gap-3">
		<Button color="alternative" href="/admin/remittances">Annuler</Button>
		<Button type="submit" disabled={selected.length === 0}>Valider le bordereau</Button>
	</div>
</form>

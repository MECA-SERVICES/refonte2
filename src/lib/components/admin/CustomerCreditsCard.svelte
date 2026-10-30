<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input, Label, Select } from 'flowbite-svelte';
	import { PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import { formatPrice } from '$lib/money';
	import type { CustomerCredit } from '$lib/server/db/counter-invoice.schema';

	/**
	 * Crédits d'un client (les « remises » de Dolibarr) : acompte, avoir,
	 * trop-perçu, reprise de machine, remise commerciale. Les disponibles se
	 * déduisent d'une facture en brouillon ; les utilisés renvoient à la facture.
	 * La page porte les actions `?/addCredit` et `?/deleteCredit`.
	 */

	type Credit = CustomerCredit & {
		sourceNumber: string | null;
		usedInvoiceId: number | null;
		usedNumber: string | null;
		isAvailable: boolean;
	};

	let { credits }: { credits: Credit[] } = $props();

	const available = $derived(credits.filter((c) => c.isAvailable));
	const used = $derived(credits.filter((c) => !c.isAvailable));
	const total = $derived(available.reduce((sum, c) => sum + Number(c.amountTtc), 0));
	const dateFmt = new Intl.DateTimeFormat('fr-FR');
	const TAX_RATES = [20, 10, 5.5, 0].map((r) => ({ value: String(r), name: `${r} %` }));

	let adding = $state(false);
	let showUsed = $state(false);
</script>

<Card class="max-w-none p-6">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-900">
			Crédits{available.length ? ` · ${formatPrice(total)} disponibles` : ''}
		</h2>
		{#if !adding}
			<Button size="xs" color="alternative" onclick={() => (adding = true)}>
				<PlusOutline class="me-1 h-3.5 w-3.5" /> Ajouter
			</Button>
		{/if}
	</div>

	{#if adding}
		<form
			method="POST"
			action="?/addCredit"
			use:enhance
			data-success="Crédit ajouté."
			class="mb-4 grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]"
		>
			<div>
				<Label for="credit-description" class="mb-1 text-xs">Motif</Label>
				<Input
					id="credit-description"
					name="description"
					size="sm"
					required
					placeholder="Reprise du robot R30, remise commerciale…"
				/>
			</div>
			<div>
				<Label for="credit-amount" class="mb-1 text-xs">Montant TTC</Label>
				<Input id="credit-amount" name="amountTtc" size="sm" inputmode="decimal" required />
			</div>
			<div>
				<Label for="credit-tax" class="mb-1 text-xs">TVA</Label>
				<Select
					id="credit-tax"
					name="taxRate"
					size="sm"
					placeholder=""
					value="20"
					items={TAX_RATES}
				/>
			</div>
			<div class="flex gap-2 sm:col-span-3">
				<Button type="submit" size="xs">Ajouter le crédit</Button>
				<Button size="xs" color="alternative" onclick={() => (adding = false)}>Annuler</Button>
			</div>
		</form>
	{/if}

	{#if available.length === 0}
		<p class="text-sm text-gray-500">Aucun crédit disponible.</p>
	{:else}
		<ul class="divide-y divide-gray-100 text-sm">
			{#each available as c (c.id)}
				<li class="flex items-center justify-between gap-3 py-2">
					<span class="min-w-0">
						<span class="block text-gray-900">{c.description}</span>
						<span class="text-xs text-gray-500">
							{dateFmt.format(new Date(c.createdAt))}{c.sourceNumber ? ` · ${c.sourceNumber}` : ''} ·
							à déduire d'une facture en brouillon
						</span>
					</span>
					<span class="flex items-center gap-2">
						<span class="font-semibold tabular-nums">{formatPrice(c.amountTtc)}</span>
						{#if !c.sourceInvoiceId && !c.legacyDoliId}
							<form
								method="POST"
								action="?/deleteCredit"
								use:enhance
								data-success="Crédit supprimé."
							>
								<input type="hidden" name="creditId" value={c.id} />
								<button
									type="submit"
									aria-label="Supprimer le crédit {c.description}"
									class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-700"
								>
									<TrashBinOutline class="h-4 w-4" />
								</button>
							</form>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if used.length}
		<button
			type="button"
			class="mt-3 text-xs text-primary-700 hover:underline"
			onclick={() => (showUsed = !showUsed)}
		>
			{showUsed ? 'Masquer' : 'Voir'} les {used.length} crédits utilisés
		</button>
		{#if showUsed}
			<ul class="mt-2 divide-y divide-gray-100 text-sm text-gray-600">
				{#each used as c (c.id)}
					<li class="flex items-center justify-between gap-3 py-1.5">
						<span class="min-w-0">
							{c.description}{c.sourceNumber ? ` (${c.sourceNumber})` : ''}
							{#if c.usedInvoiceId}
								· utilisé sur
								<a href="/admin/invoices/{c.usedInvoiceId}" class="text-primary-700 hover:underline"
									>{c.usedNumber ?? `brouillon n° ${c.usedInvoiceId}`}</a
								>
							{/if}
						</span>
						<span class="tabular-nums">{formatPrice(c.amountTtc)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</Card>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		Button,
		Card,
		Select,
		Input,
		Label,
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell
	} from 'flowbite-svelte';
	import { PageHeader, StateBadge } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const o = $derived(data.order);
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

	const stateOptions = $derived(data.states.map((s) => ({ value: String(s.id), name: s.label })));

	type Addr = {
		firstName?: string;
		lastName?: string;
		line1?: string;
		city?: string;
		postalCode?: string;
		country?: string;
	} | null;
	function fmtAddr(a: unknown): Addr {
		return (a ?? null) as Addr;
	}
</script>

<svelte:head><title>{o.reference} · Commandes</title></svelte:head>

<PageHeader
	title="Commande {o.reference}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Commandes', href: '/admin/orders' },
		{ label: o.reference }
	]}
>
	{#snippet actions()}
		{#if o.state}<StateBadge label={o.state.label} color={o.state.color} />{/if}
	{/snippet}
</PageHeader>

<div class="grid gap-6 lg:grid-cols-3">
	<!-- Colonne principale -->
	<div class="space-y-6 lg:col-span-2">
		<!-- Lignes -->
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Articles</h2>
			<Table>
				<TableHead>
					<TableHeadCell>Produit</TableHeadCell>
					<TableHeadCell>PU HT</TableHeadCell>
					<TableHeadCell>Qté</TableHeadCell>
					<TableHeadCell>Total TTC</TableHeadCell>
				</TableHead>
				<TableBody>
					{#each o.lines as line (line.id)}
						<TableBodyRow>
							<TableBodyCell>
								<span class="font-medium text-gray-900 dark:text-white">{line.productName}</span>
								{#if line.productReference}
									<span class="block text-xs text-gray-500">{line.productReference}</span>
								{/if}
							</TableBodyCell>
							<TableBodyCell>{eur.format(Number(line.unitPriceHt))}</TableBodyCell>
							<TableBodyCell>{line.quantity}</TableBodyCell>
							<TableBodyCell>{eur.format(Number(line.totalTtc))}</TableBodyCell>
						</TableBodyRow>
					{/each}
				</TableBody>
			</Table>

			<!-- Totaux -->
			<div class="mt-4 flex justify-end">
				<dl class="w-64 space-y-1 text-sm">
					<div class="flex justify-between">
						<dt class="text-gray-500">Total HT</dt>
						<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.totalHt))}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-gray-500">TVA</dt>
						<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.totalTva))}</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-gray-500">Livraison</dt>
						<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.shippingFee))}</dd>
					</div>
					{#if Number(o.discountAmount) > 0}
						<div class="flex justify-between text-green-600">
							<dt>Remise</dt>
							<dd>-{eur.format(Number(o.discountAmount))}</dd>
						</div>
					{/if}
					<div
						class="flex justify-between border-t border-gray-200 pt-1 font-semibold dark:border-gray-700"
					>
						<dt class="text-gray-900 dark:text-white">Total TTC</dt>
						<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.totalTtc))}</dd>
					</div>
				</dl>
			</div>
		</Card>

		<!-- Historique -->
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Historique des états</h2>
			{#if o.history.length > 0}
				<div class="space-y-2">
					{#each o.history as h (h.id)}
						<div
							class="flex items-center justify-between border-b border-gray-100 py-2 text-sm dark:border-gray-800"
						>
							<div class="flex items-center gap-2">
								{#if h.stateLabel}<StateBadge
										label={h.stateLabel}
										color={h.stateColor ?? '#6b7280'}
									/>{/if}
								{#if h.note}<span class="text-gray-500">— {h.note}</span>{/if}
							</div>
							<span class="text-gray-400">{dateFmt.format(new Date(h.createdAt))}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">Aucun changement enregistré.</p>
			{/if}
		</Card>
	</div>

	<!-- Colonne latérale -->
	<div class="space-y-6">
		<!-- Changement d'état -->
		<Card class="p-6">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Changer l'état</h2>
			<form method="POST" action="?/changeState" use:enhance class="space-y-3">
				{#if form?.message}<p class="text-sm text-red-600">{form.message}</p>{/if}
				<Select name="stateId" placeholder="" items={stateOptions} value={String(o.stateId)} />
				<div>
					<Label for="note" class="mb-2">Note (optionnelle)</Label>
					<Input id="note" name="note" placeholder="ex : colis remis au transporteur" />
				</div>
				<Button type="submit" class="w-full">Appliquer</Button>
			</form>
		</Card>

		<!-- Client -->
		<Card class="p-6">
			<h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Client</h2>
			{#if o.customer}
				<p class="font-medium text-gray-900 dark:text-white">
					{o.customer.firstName}
					{o.customer.lastName}
				</p>
				<p class="text-sm text-gray-500 dark:text-gray-400">{o.customer.email}</p>
				<a
					href={resolve('/admin/customers/[id]', { id: String(o.customer.id) })}
					class="mt-2 inline-block text-sm text-cyan-600"
				>
					Voir la fiche client
				</a>
			{:else}
				<p class="text-sm text-gray-500">Client supprimé.</p>
			{/if}
		</Card>

		<!-- Livraison -->
		<Card class="p-6">
			<h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Livraison</h2>
			{#if fmtAddr(o.shippingAddress)}
				{@const a = fmtAddr(o.shippingAddress)}
				<address class="text-sm text-gray-600 not-italic dark:text-gray-300">
					{a?.firstName}
					{a?.lastName}<br />
					{a?.line1}<br />
					{a?.postalCode}
					{a?.city}<br />
					{a?.country}
				</address>
			{:else}
				<p class="text-sm text-gray-500">Aucune adresse.</p>
			{/if}
			{#if o.trackingNumber}
				<p class="mt-3 text-sm">
					Suivi : <span class="font-medium">{o.trackingNumber}</span>
				</p>
			{/if}
		</Card>

		<!-- ================= Expédition Sendcloud ================= -->
		<Card size="xl" class="max-w-none">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Expédition</h2>

			{#if o.trackingNumber}
				<p class="text-sm text-gray-700 dark:text-gray-300">
					Colis créé — suivi <span class="font-medium">{o.trackingNumber}</span>
				</p>
				{#if o.trackingUrl}
					<a
						href={o.trackingUrl}
						target="_blank"
						rel="noopener"
						class="mt-1 inline-block text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
					>
						Suivre le colis
					</a>
				{/if}

				<form method="POST" action="?/label" use:enhance class="mt-4">
					<Button type="submit" color="alternative" size="sm">Récupérer l'étiquette (PDF)</Button>
				</form>

				{#if form && 'labelBase64' in form && form.labelBase64}
					<a
						href={`data:application/pdf;base64,${form.labelBase64}`}
						download={`etiquette-${o.reference}.pdf`}
						class="mt-3 inline-block text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
					>
						Télécharger etiquette-{o.reference}.pdf
					</a>
				{/if}
			{:else if !data.sendcloudReady}
				<p class="text-sm text-gray-500">
					Sendcloud n'est pas configuré : renseignez les clés d'API pour créer des colis.
				</p>
			{:else}
				{#if o.usedFallbackShipping}
					<p
						class="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
					>
						Commande passée avec la grille de repli : choisissez le transporteur réel ci-dessous.
					</p>
				{/if}

				<form method="POST" action="?/ship" use:enhance class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-4">
						<div>
							<Label for="weightKg" class="mb-1.5">Poids réel (kg)</Label>
							<Input
								id="weightKg"
								name="weightKg"
								type="number"
								step="0.001"
								min="0.001"
								value={o.packageWeightKg ?? ''}
								required
							/>
						</div>
						<div>
							<Label for="lengthCm" class="mb-1.5">Longueur (cm)</Label>
							<Input id="lengthCm" name="lengthCm" type="number" step="0.01" min="0" />
						</div>
						<div>
							<Label for="widthCm" class="mb-1.5">Largeur (cm)</Label>
							<Input id="widthCm" name="widthCm" type="number" step="0.01" min="0" />
						</div>
						<div>
							<Label for="heightCm" class="mb-1.5">Hauteur (cm)</Label>
							<Input id="heightCm" name="heightCm" type="number" step="0.01" min="0" />
						</div>
					</div>

					<div>
						<Label for="optionCode" class="mb-1.5">
							Offre d'expédition {#if o.shippingOptionCode}(retenue : {o.shippingOptionCode}){/if}
						</Label>
						<Input
							id="optionCode"
							name="optionCode"
							placeholder={o.shippingOptionCode ?? data.testOptionCode}
						/>
						<p class="mt-1 text-xs text-gray-500">
							Laissez vide pour reprendre l'offre choisie par le client. Utilisez
							<code>{data.testOptionCode}</code> pour créer une étiquette de test sans être facturé.
						</p>
					</div>

					<Button type="submit" color="primary">Créer le colis</Button>
				</form>
			{/if}
		</Card>
	</div>
</div>

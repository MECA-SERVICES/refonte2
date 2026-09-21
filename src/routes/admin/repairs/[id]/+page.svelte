<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Badge,
		Button,
		Card,
		Input,
		Label,
		Select,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Textarea
	} from 'flowbite-svelte';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import { REPAIR_STATUS_COLORS, REPAIR_STATUS_LABELS, REPAIR_TYPE_LABELS } from '$lib/repairs';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const o = $derived(data.order);
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const dateOnly = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	/** Un ordre achevé est figé : montants et pièces ne bougent plus (R17). */
	const frozen = $derived(
		o.status === 'completed' || o.status === 'delivered' || o.status === 'cancelled'
	);

	/** Saisie d'une suspension : la pièce attendue est exigée (R13). */
	let onHoldPart = $state('');
	let onHoldDate = $state('');

	const timeline = $derived(
		[
			{ label: 'Ordre créé', at: o.createdAt },
			{ label: 'Travaux démarrés', at: o.startedAt },
			{ label: 'Travaux achevés', at: o.completedAt },
			{ label: 'Règlement enregistré', at: o.paidAt },
			{ label: 'Machine restituée', at: o.deliveredAt }
		].filter((e) => e.at)
	);
</script>

<PageHeader title={o.reference} subtitle="Ordre de réparation">
	{#snippet actions()}
		<Button color="alternative" size="sm" href="/admin/repairs">Retour à la file</Button>
	{/snippet}
</PageHeader>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<Badge color={REPAIR_STATUS_COLORS[o.status]} large>{REPAIR_STATUS_LABELS[o.status]}</Badge>
	<Badge color={o.orderType === 'warranty' ? 'purple' : 'gray'}>
		{REPAIR_TYPE_LABELS[o.orderType]}
	</Badge>
	{#if o.warrantyReference}
		<span class="text-sm text-gray-500 dark:text-gray-400">
			Dossier {o.warrantyReference}
		</span>
	{/if}
	{#if o.paidAt}
		<Badge color="green">Réglé</Badge>
	{/if}
</div>

{#if form && 'statusError' in form && form.statusError}
	<Alert color="red" class="mb-4">{form.statusError}</Alert>
{/if}
{#if form && 'message' in form && form.message}
	<Alert color="red" class="mb-4">{form.message}</Alert>
{/if}

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
	<div class="space-y-6">
		<!-- ===== Machine et travaux ===== -->
		<form method="POST" action="?/update" use:enhance class="space-y-6">
			<Card class="max-w-none p-6">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Machine</h2>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<Label for="machineType" class="mb-2">Type de matériel</Label>
						<Select
							id="machineType"
							name="machineType"
							placeholder="Non précisé"
							value={o.machineType ?? ''}
							disabled={frozen}
							items={data.equipmentTypes.map((t) => ({ value: t, name: t }))}
						/>
					</div>
					<div>
						<Label for="machineBrand" class="mb-2">Marque</Label>
						<Input
							id="machineBrand"
							name="machineBrand"
							value={o.machineBrand ?? ''}
							disabled={frozen}
						/>
					</div>
					<div>
						<Label for="machineModel" class="mb-2">Modèle</Label>
						<Input
							id="machineModel"
							name="machineModel"
							value={o.machineModel ?? ''}
							disabled={frozen}
						/>
					</div>
					<div>
						<Label for="serialNumber" class="mb-2">Numéro de série</Label>
						<Input
							id="serialNumber"
							name="serialNumber"
							value={o.serialNumber ?? ''}
							disabled={frozen}
						/>
					</div>
					<div>
						<Label for="engineModel" class="mb-2">Modèle du moteur</Label>
						<Input
							id="engineModel"
							name="engineModel"
							value={o.engineModel ?? ''}
							disabled={frozen}
						/>
					</div>
					<div>
						<Label for="engineSerialNumber" class="mb-2">Numéro de série du moteur</Label>
						<Input
							id="engineSerialNumber"
							name="engineSerialNumber"
							value={o.engineSerialNumber ?? ''}
							disabled={frozen}
						/>
					</div>
					<div class="sm:col-span-2">
						<Label for="machineCondition" class="mb-2">État constaté à la prise en charge</Label>
						<Textarea
							id="machineCondition"
							name="machineCondition"
							rows={2}
							value={o.machineCondition ?? ''}
							disabled={frozen}
						/>
					</div>
				</div>
			</Card>

			<Card class="max-w-none p-6">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
					Travaux et main-d'œuvre
				</h2>
				<div class="space-y-4">
					<div>
						<Label for="workDescription" class="mb-2">Description des travaux réalisés</Label>
						<Textarea
							id="workDescription"
							name="workDescription"
							rows={4}
							value={o.workDescription ?? ''}
							disabled={frozen}
						/>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Obligatoire avant de marquer l'ordre comme achevé.
						</p>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<Label for="diagnosticFee" class="mb-2">Frais de diagnostic HT (€)</Label>
							<Input
								id="diagnosticFee"
								name="diagnosticFee"
								type="number"
								step="0.01"
								min="0"
								value={o.diagnosticFee}
								disabled={frozen}
							/>
						</div>
						<div>
							<Label for="laborAmount" class="mb-2">Main-d'œuvre HT (€)</Label>
							<Input
								id="laborAmount"
								name="laborAmount"
								type="number"
								step="0.01"
								min="0"
								value={o.laborAmount}
								disabled={frozen}
							/>
						</div>
					</div>
				</div>
			</Card>

			<Card class="max-w-none p-6">
				<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Notes</h2>
				<div class="space-y-4">
					<div>
						<Label for="notes" class="mb-2">Note visible du client</Label>
						<Textarea id="notes" name="notes" rows={2} value={o.notes ?? ''} disabled={frozen} />
					</div>
					<div>
						<Label for="privateNote" class="mb-2">Note interne</Label>
						<Textarea
							id="privateNote"
							name="privateNote"
							rows={2}
							value={o.privateNote ?? ''}
							disabled={frozen}
						/>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Jamais visible du client ni portée sur un document.
						</p>
					</div>
				</div>
			</Card>

			{#if !frozen}
				<div class="flex justify-end">
					<Button type="submit">Enregistrer</Button>
				</div>
			{/if}
		</form>

		<!-- ===== Pièces consommées ===== -->
		<Card class="max-w-none p-6">
			<h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
				Pièces consommées ({o.parts.length})
			</h2>
			<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
				Une pièce rattachée au catalogue sort immédiatement du stock. Son retrait la réintègre.
			</p>

			{#if form && 'partError' in form && form.partError}
				<Alert color="red" class="mb-3">{form.partError}</Alert>
			{/if}

			{#if o.parts.length > 0}
				<Table>
					<TableHead>
						<TableHeadCell>Désignation</TableHeadCell>
						<TableHeadCell>Référence</TableHeadCell>
						<TableHeadCell class="text-right">Qté</TableHeadCell>
						<TableHeadCell class="text-right">P.U. HT</TableHeadCell>
						<TableHeadCell class="text-right">Total HT</TableHeadCell>
						<TableHeadCell></TableHeadCell>
					</TableHead>
					<TableBody>
						{#each o.parts as part (part.id)}
							<TableBodyRow>
								<TableBodyCell>
									{part.partName}
									{#if !part.productId}
										<span class="ms-1 text-xs text-gray-400">(hors catalogue)</span>
									{/if}
								</TableBodyCell>
								<TableBodyCell>{part.partReference ?? '—'}</TableBodyCell>
								<TableBodyCell class="text-right">{part.quantity}</TableBodyCell>
								<TableBodyCell class="text-right"
									>{eur.format(Number(part.unitPriceHt))}</TableBodyCell
								>
								<TableBodyCell class="text-right">{eur.format(Number(part.totalHt))}</TableBodyCell>
								<TableBodyCell class="text-right">
									{#if !frozen}
										<form method="POST" action="?/removePart" use:enhance>
											<input type="hidden" name="partId" value={part.id} />
											<Button type="submit" size="xs" color="alternative">Retirer</Button>
										</form>
									{/if}
								</TableBodyCell>
							</TableBodyRow>
						{/each}
					</TableBody>
				</Table>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">Aucune pièce consommée.</p>
			{/if}

			{#if !frozen}
				<form method="POST" action="?/addPart" use:enhance class="mt-4 grid gap-3 sm:grid-cols-6">
					<div class="sm:col-span-2">
						<Label for="productId" class="mb-2">Article du catalogue</Label>
						<Input id="productId" name="productId" type="number" placeholder="Identifiant" />
					</div>
					<div class="sm:col-span-2">
						<Label for="partName" class="mb-2">ou désignation libre</Label>
						<Input id="partName" name="partName" placeholder="Désignation de la pièce" />
					</div>
					<div>
						<Label for="quantity" class="mb-2">Quantité</Label>
						<Input id="quantity" name="quantity" type="number" min="1" value="1" />
					</div>
					<div>
						<Label for="unitPriceHt" class="mb-2">P.U. HT (€)</Label>
						<Input id="unitPriceHt" name="unitPriceHt" type="number" step="0.01" min="0" />
					</div>
					<div class="flex justify-end sm:col-span-6">
						<Button type="submit" size="sm">Ajouter la pièce</Button>
					</div>
				</form>
			{/if}
		</Card>
	</div>

	<!-- ===== Colonne latérale ===== -->
	<aside class="space-y-4 lg:sticky lg:top-4">
		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Client</h3>
			<p class="text-sm font-medium text-gray-900 dark:text-white">
				{[o.customer.customerFirstName, o.customer.customerLastName].filter(Boolean).join(' ')}
			</p>
			{#if o.customer.customerCompany}
				<p class="text-sm text-gray-500 dark:text-gray-400">{o.customer.customerCompany}</p>
			{/if}
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{o.customer.customerEmail}</p>
			{#if o.customer.customerPhone}
				<p class="text-xs text-gray-500 dark:text-gray-400">{o.customer.customerPhone}</p>
			{/if}
			<Button
				size="xs"
				color="alternative"
				href="/admin/customers/{o.customerId}"
				class="mt-3 w-full"
			>
				Voir la fiche
			</Button>
		</Card>

		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Montants</h3>
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between">
					<dt class="text-gray-500 dark:text-gray-400">Frais de diagnostic</dt>
					<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.diagnosticFee))}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-gray-500 dark:text-gray-400">Main-d'œuvre</dt>
					<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.laborAmount))}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-gray-500 dark:text-gray-400">Pièces</dt>
					<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.totalPartsHt))}</dd>
				</div>
				<div class="flex justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
					<dt class="font-medium text-gray-900 dark:text-white">Total HT</dt>
					<dd class="font-medium text-gray-900 dark:text-white">{eur.format(Number(o.totalHt))}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-gray-500 dark:text-gray-400">TVA</dt>
					<dd class="text-gray-900 dark:text-white">{eur.format(Number(o.totalTva))}</dd>
				</div>
				<div class="flex justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
					<dt class="font-semibold text-gray-900 dark:text-white">
						{o.orderType === 'warranty' ? 'À régler' : 'Total TTC'}
					</dt>
					<dd class="font-semibold text-gray-900 dark:text-white">
						{eur.format(Number(o.totalTtc))}
					</dd>
				</div>
			</dl>
			{#if o.orderType === 'warranty'}
				<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
					Prise en charge sous garantie : les montants sont calculés pour le suivi, rien n'est dû
					par le client.
				</p>
			{/if}
		</Card>

		<!-- Avancement : seules les transitions prévues sont proposées. -->
		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Avancement</h3>

			{#if data.transitions.length === 0}
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Cet ordre a atteint un état définitif.
				</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each data.transitions as target (target)}
						{#if target === 'on_hold'}
							<form method="POST" action="?/changeStatus" use:enhance class="space-y-2">
								<input type="hidden" name="status" value="on_hold" />
								<Label for="onHoldPartLabel" class="text-xs">Pièce attendue</Label>
								<Input
									id="onHoldPartLabel"
									name="onHoldPartLabel"
									bind:value={onHoldPart}
									size="sm"
									required
								/>
								<Label for="onHoldExpectedAt" class="text-xs">Date prévue</Label>
								<Input
									id="onHoldExpectedAt"
									name="onHoldExpectedAt"
									type="date"
									bind:value={onHoldDate}
									size="sm"
								/>
								<Button type="submit" size="sm" color="alternative" class="w-full">
									Suspendre les travaux
								</Button>
							</form>
						{:else}
							<form method="POST" action="?/changeStatus" use:enhance>
								<input type="hidden" name="status" value={target} />
								<Button
									type="submit"
									size="sm"
									color={target === 'cancelled' ? 'alternative' : 'primary'}
									class="w-full"
								>
									{REPAIR_STATUS_LABELS[target]}
								</Button>
							</form>
						{/if}
					{/each}
				</div>
			{/if}

			{#if o.status === 'on_hold' && o.onHoldPartLabel}
				<div class="mt-3 rounded-lg bg-yellow-50 p-3 text-xs dark:bg-yellow-900/20">
					<p class="font-medium text-gray-900 dark:text-white">En attente : {o.onHoldPartLabel}</p>
					{#if o.onHoldExpectedAt}
						<p class="text-gray-500 dark:text-gray-400">
							Attendue le {dateOnly.format(new Date(o.onHoldExpectedAt))}
						</p>
					{/if}
				</div>
			{/if}

			{#if o.status === 'completed' && !o.paidAt && o.orderType === 'paid'}
				<form method="POST" action="?/markPaid" use:enhance class="mt-3">
					<Button type="submit" size="sm" color="alternative" class="w-full">
						Enregistrer le règlement
					</Button>
				</form>
			{/if}
		</Card>

		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Suivi</h3>
			<ol class="space-y-2 text-xs">
				{#each timeline as entry (entry.label)}
					<li class="flex justify-between gap-2">
						<span class="text-gray-500 dark:text-gray-400">{entry.label}</span>
						<span class="text-gray-900 dark:text-white">
							{dateTime.format(new Date(entry.at!))}
						</span>
					</li>
				{/each}
			</ol>
		</Card>
	</aside>
</div>

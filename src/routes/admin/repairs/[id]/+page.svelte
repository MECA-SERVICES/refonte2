<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import {
		Alert,
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
	import { FilePdfOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import StateBadge from '$lib/components/admin/StateBadge.svelte';
	import DocumentLineStock from '$lib/components/admin/DocumentLineStock.svelte';
	import { REPAIR_STATUS_COLORS, REPAIR_STATUS_LABELS, REPAIR_TYPE_LABELS } from '$lib/repairs';
	import {
		remainingDue,
		SETTLEMENT_METHOD_LABELS,
		settlementMethods,
		type SettlementMethod
	} from '$lib/settlements';
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

	/**
	 * Reste à régler. Un ordre marqué réglé sans règlement détaillé (saisi
	 * avant le suivi des règlements) ne doit plus rien.
	 */
	const due = $derived(
		o.paidAt
			? 0
			: remainingDue(
					o.totalTtc,
					data.settlements.map((s) => s.amount)
				)
	);
	/** R19 : le règlement suit l'achèvement, pour une prise en charge payante. */
	const canSettle = $derived(
		o.orderType === 'paid' && (o.status === 'completed' || o.status === 'delivered') && due > 0
	);
	let settlementMethod = $state<SettlementMethod>('cheque');
	/** Date du jour au format des champs `date` (AAAA-MM-JJ). */
	const today = new Date().toLocaleDateString('sv-SE');
	const customerName = $derived(
		o.customer.customerCompany ||
			[o.customer.customerFirstName, o.customer.customerLastName].filter(Boolean).join(' ')
	);

	/** Un type de matériel désactivé reste proposé à l'ordre qui le porte déjà. */
	const machineTypeOptions = $derived(
		[
			...data.equipmentTypes,
			...(o.machineType && !data.equipmentTypes.includes(o.machineType) ? [o.machineType] : [])
		].map((t) => ({ value: t, name: t }))
	);

	/** Saisie d'une suspension : la pièce attendue est exigée (R13). */
	let onHoldPart = $state('');
	let onHoldDate = $state('');

	/**
	 * Évolution de l'ordre (13.8) : chaque passage d'état, suspensions et
	 * reprises comprises, puis les règlements, dans l'ordre chronologique.
	 */
	const timeline = $derived(
		[
			...o.history.map((h) => ({
				key: `h${h.id}`,
				label: h.status === 'to_do' ? 'Ordre créé' : REPAIR_STATUS_LABELS[h.status],
				detail: [h.note, h.changedBy].filter(Boolean).join(' · '),
				at: new Date(h.createdAt)
			})),
			...data.settlements.map((s) => ({
				key: `s${s.id}`,
				label: `Règlement ${SETTLEMENT_METHOD_LABELS[s.method].toLowerCase()}`,
				detail: `${eur.format(Number(s.amount))} · ${s.reference}`,
				at: new Date(s.createdAt)
			}))
		].sort((a, b) => a.at.getTime() - b.at.getTime())
	);
</script>

<svelte:head><title>{o.reference} · Réparations</title></svelte:head>

<PageHeader title={o.reference} subtitle="Ordre de réparation">
	{#snippet actions()}
		<Button size="sm" href="/admin/repairs/{o.id}/pdf" target="_blank" rel="noopener">
			<FilePdfOutline class="me-2 h-4 w-4" /> Ordre PDF
		</Button>
		<Button color="alternative" size="sm" href="/admin/repairs">Retour à la file</Button>
	{/snippet}
</PageHeader>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<StateBadge color={REPAIR_STATUS_COLORS[o.status]} label={REPAIR_STATUS_LABELS[o.status]} />
	<StateBadge
		color={o.orderType === 'warranty' ? 'purple' : 'gray'}
		label={REPAIR_TYPE_LABELS[o.orderType]}
	/>
	{#if o.workshopLabel}
		<StateBadge color="indigo" label={`Étiquette ${o.workshopLabel}`} />
	{/if}
	{#if o.warrantyReference}
		<span class="text-sm text-gray-500">
			Dossier {o.warrantyReference}
		</span>
	{/if}
	{#if o.paidAt}
		<StateBadge color="green" label="Réglé" />
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
				<h2 class="mb-4 text-lg font-semibold text-gray-900">Machine</h2>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<Label for="machineType" class="mb-2">Type de matériel</Label>
						<Select
							id="machineType"
							name="machineType"
							placeholder="Non précisé"
							value={o.machineType ?? ''}
							disabled={frozen}
							items={machineTypeOptions}
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
							class="w-full"
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
				<h2 class="mb-4 text-lg font-semibold text-gray-900">Travaux et main-d'œuvre</h2>
				<div class="space-y-4">
					<div>
						<Label for="workDescription" class="mb-2">Description des travaux réalisés</Label>
						<Textarea
							class="w-full"
							id="workDescription"
							name="workDescription"
							rows={4}
							value={o.workDescription ?? ''}
							disabled={frozen}
						/>
						<p class="mt-1 text-xs text-gray-500">
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
				<h2 class="mb-4 text-lg font-semibold text-gray-900">Notes</h2>
				<div class="space-y-4">
					<div>
						<Label for="notes" class="mb-2">Note visible du client</Label>
						<Textarea
							class="w-full"
							id="notes"
							name="notes"
							rows={2}
							value={o.notes ?? ''}
							disabled={frozen}
						/>
					</div>
					<div>
						<Label for="privateNote" class="mb-2">Note interne</Label>
						<Textarea
							class="w-full"
							id="privateNote"
							name="privateNote"
							rows={2}
							value={o.privateNote ?? ''}
							disabled={frozen}
						/>
						<p class="mt-1 text-xs text-gray-500">
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
			<h2 class="mb-1 text-lg font-semibold text-gray-900">
				Pièces consommées ({o.parts.length})
			</h2>
			<p class="mb-4 text-xs text-gray-500">
				Rien ne sort du stock automatiquement : le magasinier sort chaque pièce du catalogue de son
				emplacement, avec « Sortir du stock ».
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
								<TableBodyCell class="whitespace-normal">
									{part.partName}
									{#if !part.productId}
										<span class="ms-1 text-xs text-gray-400">(hors catalogue)</span>
									{:else if data.partStock[part.productId]}
										<DocumentLineStock
											productId={part.productId}
											stock={data.partStock[part.productId]}
										/>
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
										<form
											method="POST"
											action="?/removePart"
											use:enhance
											data-success="Pièce retirée."
										>
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
				<p class="text-sm text-gray-500">Aucune pièce consommée.</p>
			{/if}

			{#if !frozen}
				<form
					method="POST"
					action="?/addPart"
					use:enhance
					data-success="Pièce ajoutée."
					class="mt-4 grid gap-3 sm:grid-cols-6"
				>
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
		<!-- Étiquette : hors du formulaire principal, elle reste modifiable sur un ordre figé. -->
		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900">Étiquette atelier</h3>
			<form
				method="POST"
				action="?/setLabel"
				use:enhance
				data-success="Étiquette enregistrée."
				class="flex gap-2"
			>
				<Input
					id="workshopLabel"
					name="workshopLabel"
					aria-label="Numéro de l'étiquette"
					placeholder="N° d'étiquette"
					value={o.workshopLabel ?? ''}
					size="sm"
					class="flex-1"
				/>
				<Button type="submit" size="sm" color="alternative">OK</Button>
			</form>
			{#if form && 'labelError' in form && form.labelError}
				<p class="mt-2 text-xs text-red-600">{form.labelError}</p>
			{/if}
		</Card>

		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900">Client</h3>
			<p class="text-sm font-medium text-gray-900">
				{[o.customer.customerFirstName, o.customer.customerLastName].filter(Boolean).join(' ')}
			</p>
			{#if o.customer.customerCompany}
				<p class="text-sm text-gray-500">{o.customer.customerCompany}</p>
			{/if}
			<p class="mt-1 text-xs text-gray-500">{o.customer.customerEmail}</p>
			{#if o.customer.customerPhone}
				<p class="text-xs text-gray-500">{o.customer.customerPhone}</p>
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
			<h3 class="mb-3 text-sm font-semibold text-gray-900">Montants</h3>
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between">
					<dt class="text-gray-500">Frais de diagnostic</dt>
					<dd class="text-gray-900">{eur.format(Number(o.diagnosticFee))}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-gray-500">Main-d'œuvre</dt>
					<dd class="text-gray-900">{eur.format(Number(o.laborAmount))}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-gray-500">Pièces</dt>
					<dd class="text-gray-900">{eur.format(Number(o.totalPartsHt))}</dd>
				</div>
				<div class="flex justify-between border-t border-gray-100 pt-2">
					<dt class="font-medium text-gray-900">Total HT</dt>
					<dd class="font-medium text-gray-900">{eur.format(Number(o.totalHt))}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-gray-500">TVA</dt>
					<dd class="text-gray-900">{eur.format(Number(o.totalTva))}</dd>
				</div>
				<div class="flex justify-between border-t border-gray-100 pt-2">
					<dt class="font-semibold text-gray-900">
						{o.orderType === 'warranty' ? 'À régler' : 'Total TTC'}
					</dt>
					<dd class="font-semibold text-gray-900">
						{eur.format(Number(o.totalTtc))}
					</dd>
				</div>
			</dl>
			{#if o.orderType === 'warranty'}
				<p class="mt-3 text-xs text-gray-500">
					Prise en charge sous garantie : les montants sont calculés pour le suivi, rien n'est dû
					par le client.
				</p>
			{/if}
		</Card>

		{#if o.orderType === 'paid'}
			<Card class="max-w-none p-4">
				<h3 class="mb-3 text-sm font-semibold text-gray-900">Règlements</h3>

				{#if data.settlements.length > 0}
					<ul class="mb-3 space-y-2 text-sm">
						{#each data.settlements as s (s.id)}
							<li class="flex justify-between gap-2">
								<div>
									<p class="font-medium text-gray-900">
										{SETTLEMENT_METHOD_LABELS[s.method]}
										{#if s.chequeNumber}n° {s.chequeNumber}{/if}
									</p>
									<p class="text-xs text-gray-500">
										{s.reference} · {dateOnly.format(new Date(s.receivedOn))}
										{#if s.chequeIssuer}· {s.chequeIssuer}{/if}
									</p>
								</div>
								<span class="text-gray-900">{eur.format(Number(s.amount))}</span>
							</li>
						{/each}
					</ul>
				{:else if !o.paidAt}
					<p class="mb-3 text-xs text-gray-500">Aucun règlement enregistré.</p>
				{/if}

				<div class="flex justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
					<span class="text-gray-900">
						{due > 0 ? 'Reste à régler' : 'Réglé'}
					</span>
					<span class={due > 0 ? 'text-red-600' : 'text-green-600'}>
						{eur.format(due)}
					</span>
				</div>

				{#if canSettle}
					<form
						method="POST"
						action="?/recordPayment"
						use:enhance
						data-success="Règlement enregistré."
						class="mt-4 space-y-3"
					>
						<div>
							<Label for="settlementMethod" class="mb-1 text-xs">Mode de règlement</Label>
							<Select
								id="settlementMethod"
								name="method"
								size="sm"
								placeholder=""
								bind:value={settlementMethod}
								items={settlementMethods.map((m) => ({
									value: m,
									name: SETTLEMENT_METHOD_LABELS[m]
								}))}
							/>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<Label for="settlementAmount" class="mb-1 text-xs">Montant (€)</Label>
								<Input
									id="settlementAmount"
									name="amount"
									type="number"
									step="0.01"
									min="0.01"
									max={due.toFixed(2)}
									value={due.toFixed(2)}
									size="sm"
									required
								/>
							</div>
							<div>
								<Label for="settlementDate" class="mb-1 text-xs">Reçu le</Label>
								<Input
									id="settlementDate"
									name="receivedOn"
									type="date"
									value={today}
									size="sm"
									required
								/>
							</div>
						</div>
						{#if settlementMethod === 'cheque'}
							<div>
								<Label for="chequeNumber" class="mb-1 text-xs">Numéro du chèque</Label>
								<Input id="chequeNumber" name="chequeNumber" size="sm" required />
							</div>
							<div>
								<Label for="chequeIssuer" class="mb-1 text-xs">Émetteur</Label>
								<Input id="chequeIssuer" name="chequeIssuer" value={customerName} size="sm" />
							</div>
							<div>
								<Label for="chequeBank" class="mb-1 text-xs">Banque</Label>
								<Input id="chequeBank" name="chequeBank" size="sm" />
							</div>
						{/if}
						{#if form && 'paymentError' in form && form.paymentError}
							<p class="text-xs text-red-600">{form.paymentError}</p>
						{/if}
						<Button type="submit" size="sm" class="w-full">Enregistrer le règlement</Button>
					</form>
				{:else if due > 0 && o.status !== 'cancelled'}
					<p class="mt-3 text-xs text-gray-500">
						Le règlement s'enregistre une fois les travaux achevés.
					</p>
				{/if}
			</Card>
		{/if}

		<!-- Avancement : seules les transitions prévues sont proposées. -->
		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900">Avancement</h3>

			{#if data.transitions.length === 0}
				<p class="text-xs text-gray-500">Cet ordre a atteint un état définitif.</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each data.transitions as target (target)}
						{#if target === 'on_hold'}
							<form
								method="POST"
								action="?/changeStatus"
								use:enhance
								data-success="État mis à jour."
								class="space-y-2"
							>
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
							<form
								method="POST"
								action="?/changeStatus"
								use:enhance
								data-success="État mis à jour."
							>
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
				<div class="mt-3 rounded-lg bg-yellow-50 p-3 text-xs">
					<p class="font-medium text-gray-900">En attente : {o.onHoldPartLabel}</p>
					{#if o.onHoldExpectedAt}
						<p class="text-gray-500">
							Attendue le {dateOnly.format(new Date(o.onHoldExpectedAt))}
						</p>
					{/if}
				</div>
			{/if}
		</Card>

		<Card class="max-w-none p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-900">Évolution</h3>
			<ol class="space-y-2.5 border-s border-gray-200 ps-3 text-xs">
				{#each timeline as entry (entry.key)}
					<li>
						<div class="flex justify-between gap-2">
							<span class="font-medium text-gray-900">{entry.label}</span>
							<span class="shrink-0 text-gray-500">
								{dateTime.format(entry.at)}
							</span>
						</div>
						{#if entry.detail}
							<p class="text-gray-500">{entry.detail}</p>
						{/if}
					</li>
				{/each}
			</ol>
		</Card>
	</aside>
</div>

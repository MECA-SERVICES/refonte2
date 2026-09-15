<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input, Label, Select, Textarea } from 'flowbite-svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Machine = (typeof data.machines)[number];

	/**
	 * Machine en cours d'édition : `null` ferme le formulaire, un objet vide
	 * ouvre un ajout. Un formulaire unique sert les deux cas — dupliquer sa
	 * dizaine de champs n'apporterait rien.
	 */
	let editing = $state<Machine | Record<string, never> | null>(null);

	/** Machine dont on saisit le numéro de série pour la confirmer. */
	let confirming = $state<number | null>(null);

	/** Suppression en attente de confirmation, par machine. */
	let removing = $state<number | null>(null);

	const isNew = $derived(editing !== null && !('id' in editing));
	const current = $derived(editing as Machine | null);

	const typeOptions = $derived(data.equipmentTypes.map((t) => ({ value: t, name: t })));

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	/** Date au format attendu par un champ `date`. */
	const asDateInput = (value: Date | null) =>
		value ? new Date(value).toISOString().slice(0, 10) : '';

	const pendingCount = $derived(
		data.machines.filter((m) => m.status === 'pending_confirmation').length
	);
</script>

<svelte:head>
	<title>Mon parc machines — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Mon parc machines' }]} />

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1
			class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[32px]"
		>
			Mon parc machines
		</h1>
		<p class="mt-1 text-sm text-shop-muted">
			{#if data.machines.length > 0}
				{data.machines.length} machine{data.machines.length > 1 ? 's' : ''} enregistrée{data
					.machines.length > 1
					? 's'
					: ''}. Vos numéros de série nous aident à trouver la bonne pièce du premier coup.
			{:else}
				Enregistrez vos machines pour retrouver plus vite les pièces qui leur correspondent.
			{/if}
		</p>
	</div>

	{#if editing === null}
		<ShopButton variant="primary" onclick={() => (editing = {})}>Ajouter une machine</ShopButton>
	{/if}
</div>

{#if form?.message}
	<p
		class="mt-5 border-[1.5px] border-shop-red bg-white px-4 py-3 text-sm font-medium text-shop-red"
	>
		{form.message}
	</p>
{/if}

{#if pendingCount > 0}
	<!-- Une proposition automatique attend son numéro de série : tant qu'elle
	     n'est pas confirmée, elle ne sert pas à identifier les pièces (R11). -->
	<p
		class="mt-5 border-[1.5px] border-shop-orange bg-white px-4 py-3 text-[14.5px] text-shop-ink"
	>
		<span class="font-bold">
			{pendingCount} machine{pendingCount > 1 ? 's' : ''} à compléter.
		</span>
		Ajoutez leur numéro de série pour que nous puissions identifier leurs pièces.
	</p>
{/if}

<!-- ================= Formulaire ================= -->
{#if editing !== null}
	<Panel class="mt-6 p-5">
		<Heading size="card">{isNew ? 'Nouvelle machine' : 'Modifier la machine'}</Heading>

		<form
			method="POST"
			action="?/save"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') editing = null;
					await update();
				}}
			class="mt-4 space-y-5"
		>
			{#if !isNew && current}
				<input type="hidden" name="id" value={current.id} />
			{/if}

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="name" class="mb-1.5">Nom d'usage *</Label>
					<Input id="name" name="name" required value={current?.name ?? ''} placeholder="Tondeuse du fond" />
				</div>
				<div>
					<Label for="equipmentType" class="mb-1.5">Type d'équipement *</Label>
					<Select
						id="equipmentType"
						name="equipmentType"
						items={typeOptions}
						value={current?.equipmentType ?? ''}
						required
					/>
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<Label for="brand" class="mb-1.5">Marque</Label>
					<Input id="brand" name="brand" value={current?.brand ?? ''} />
				</div>
				<div>
					<Label for="model" class="mb-1.5">Modèle</Label>
					<Input id="model" name="model" value={current?.model ?? ''} />
				</div>
				<div>
					<Label for="serialNumber" class="mb-1.5">Numéro de série</Label>
					<Input id="serialNumber" name="serialNumber" value={current?.serialNumber ?? ''} />
				</div>
			</div>

			<p class="text-[13px] text-shop-muted">
				Le numéro de série figure sur la plaque rivetée du carter, sous le châssis pour les
				tondeuses, sur le bloc moteur pour les autoportées.
			</p>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="engineModel" class="mb-1.5">Modèle du moteur</Label>
					<Input id="engineModel" name="engineModel" value={current?.engineModel ?? ''} />
				</div>
				<div>
					<Label for="engineSerialNumber" class="mb-1.5">N° de série du moteur</Label>
					<Input
						id="engineSerialNumber"
						name="engineSerialNumber"
						value={current?.engineSerialNumber ?? ''}
					/>
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="warrantyEndDate" class="mb-1.5">Fin de garantie</Label>
					<Input
						id="warrantyEndDate"
						name="warrantyEndDate"
						type="date"
						value={asDateInput(current?.warrantyEndDate ?? null)}
					/>
				</div>
				<div>
					<Label for="warrantyInfo" class="mb-1.5">Informations de garantie</Label>
					<Input id="warrantyInfo" name="warrantyInfo" value={current?.warrantyInfo ?? ''} />
				</div>
			</div>

			<div>
				<Label for="notes" class="mb-1.5">Notes personnelles</Label>
				<Textarea id="notes" name="notes" rows={2} value={current?.notes ?? ''} />
			</div>

			<div class="flex flex-wrap gap-3">
				<ShopButton variant="buy" type="submit">Enregistrer</ShopButton>
				<ShopButton variant="outline" type="button" onclick={() => (editing = null)}>
					Annuler
				</ShopButton>
			</div>
		</form>
	</Panel>
{/if}

<!-- ================= Recherche ================= -->
{#if data.machines.length > 0 || data.search}
	<form method="GET" class="mt-6 flex flex-wrap gap-2">
		<Input
			name="q"
			type="search"
			value={data.search}
			placeholder="Nom, marque, modèle ou numéro de série…"
			aria-label="Rechercher dans mon parc"
			class="max-w-md"
		/>
		<ShopButton variant="outline" type="submit">Rechercher</ShopButton>
		{#if data.search}
			<ShopButton variant="secondary" href="/compte/machines">Effacer</ShopButton>
		{/if}
	</form>
{/if}

<!-- ================= Liste ================= -->
{#if data.machines.length === 0}
	<Panel class="mt-6 p-6">
		<Heading size="card">
			{data.search ? 'Aucun résultat' : 'Aucune machine enregistrée'}
		</Heading>
		<p class="mt-2 max-w-[54ch] text-[14.5px] text-shop-muted">
			{#if data.search}
				Aucune machine ne correspond à « {data.search} ».
			{:else}
				Enregistrez vos tondeuses, tronçonneuses ou tracteurs : nous retrouverons leurs pièces
				d'origine sans que vous ayez à chercher la référence.
			{/if}
		</p>
		{#if !data.search && editing === null}
			<div class="mt-5">
				<ShopButton variant="primary" onclick={() => (editing = {})}>
					Ajouter ma première machine
				</ShopButton>
			</div>
		{/if}
	</Panel>
{:else}
	<div class="mt-6 space-y-4">
		{#each data.machines as machine (machine.id)}
			{@const isPending = machine.status === 'pending_confirmation'}
			<Panel class="p-5">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-display text-[15.5px] font-bold text-shop-ink">
								{machine.name}
							</span>
							<span
								class="bg-shop-border-soft px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-shop-ink uppercase"
							>
								{machine.equipmentType}
							</span>
							{#if isPending}
								<span
									class="bg-shop-orange px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase"
								>
									À compléter
								</span>
							{/if}
						</div>

						<dl class="mt-2 space-y-0.5 text-[13.5px] text-shop-ink-soft">
							{#if machine.brand || machine.model}
								<div>{machine.brand ?? ''} {machine.model ?? ''}</div>
							{/if}
							{#if machine.serialNumber}
								<div>N° de série : <span class="font-medium">{machine.serialNumber}</span></div>
							{/if}
							{#if machine.engineModel}
								<div>Moteur : {machine.engineModel}</div>
							{/if}
							{#if machine.warrantyEndDate}
								<div>
									Garantie jusqu'au {dateFmt.format(new Date(machine.warrantyEndDate))}
								</div>
							{/if}
							{#if machine.notes}
								<div class="text-shop-muted italic">{machine.notes}</div>
							{/if}
						</dl>
					</div>

					<div class="flex shrink-0 flex-wrap gap-2">
						{#if !isPending}
							<ShopButton
								variant="outline"
								size="sm"
								href="/vue-eclatee"
								title="Trouver les pièces de cette machine"
							>
								Ses pièces
							</ShopButton>
						{/if}
						<ShopButton
							variant="outline"
							size="sm"
							onclick={() => {
								editing = machine;
								confirming = null;
								removing = null;
							}}
						>
							Modifier
						</ShopButton>

						{#if removing === machine.id}
							<form method="POST" action="?/delete" use:enhance class="flex gap-2">
								<input type="hidden" name="id" value={machine.id} />
								<ShopButton variant="buy" size="sm" type="submit">Confirmer</ShopButton>
								<ShopButton
									variant="outline"
									size="sm"
									type="button"
									onclick={() => (removing = null)}
								>
									Annuler
								</ShopButton>
							</form>
						{:else}
							<ShopButton variant="secondary" size="sm" onclick={() => (removing = machine.id)}>
								{isPending ? 'Ce n’est pas à moi' : 'Retirer'}
							</ShopButton>
						{/if}
					</div>
				</div>

				<!-- Confirmation d'une proposition : seul le numéro de série manque (R10). -->
				{#if isPending}
					<div class="mt-4 border-t-[1.5px] border-shop-border-soft pt-4">
						{#if confirming === machine.id}
							<form method="POST" action="?/confirm" use:enhance class="flex flex-wrap items-end gap-3">
								<input type="hidden" name="id" value={machine.id} />
								<div>
									<Label for="serial-{machine.id}" class="mb-1.5">Numéro de série</Label>
									<Input id="serial-{machine.id}" name="serialNumber" required />
								</div>
								<ShopButton variant="buy" size="sm" type="submit">Confirmer</ShopButton>
								<ShopButton
									variant="outline"
									size="sm"
									type="button"
									onclick={() => (confirming = null)}
								>
									Annuler
								</ShopButton>
							</form>
						{:else}
							<p class="text-[13.5px] text-shop-muted">
								Cette machine a été ajoutée depuis une de vos commandes.
								<button
									type="button"
									onclick={() => (confirming = machine.id)}
									class="font-semibold text-shop-blue hover:underline"
								>
									Ajouter son numéro de série
								</button>
							</p>
						{/if}
					</div>
				{/if}
			</Panel>
		{/each}
	</div>
{/if}

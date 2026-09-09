<script lang="ts">
	import { enhance } from '$app/forms';
	import { Checkbox, Input, Label } from 'flowbite-svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Address = (typeof data.addresses)[number];

	/**
	 * Adresse en cours d'édition : `null` ferme le formulaire, un objet vide
	 * ouvre une création. Le formulaire est unique — dupliquer sa quinzaine de
	 * champs pour la création et la modification n'apporterait rien.
	 */
	let editing = $state<Address | Record<string, never> | null>(null);

	/** Confirmation de suppression, par adresse : évite un retrait accidentel. */
	let confirming = $state<number | null>(null);

	const isNew = $derived(editing !== null && !('id' in editing));

	/** Champs texte du formulaire — les indicateurs booléens sont lus directement. */
	type TextField =
		| 'label'
		| 'firstName'
		| 'lastName'
		| 'company'
		| 'line1'
		| 'line2'
		| 'postalCode'
		| 'city'
		| 'country'
		| 'phone';

	const value = (key: TextField) => (editing as Address | null)?.[key] ?? '';
</script>

<svelte:head>
	<title>Mes adresses — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Mes adresses' }]} />

<div>
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1
				class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[32px]"
			>
				Mes adresses
			</h1>
			<p class="mt-1 text-sm text-shop-muted">
				{#if data.addresses.length > 0}
					{data.addresses.length} adresse{data.addresses.length > 1 ? 's' : ''} enregistrée{data
						.addresses.length > 1
						? 's'
						: ''}, réutilisée{data.addresses.length > 1 ? 's' : ''} lors de vos commandes.
				{:else}
					Vos adresses de livraison et de facturation, réutilisées lors de vos commandes.
				{/if}
			</p>
		</div>

		{#if editing === null}
			<ShopButton variant="primary" onclick={() => (editing = {})}>Ajouter une adresse</ShopButton>
		{/if}
	</div>

	{#if form?.message}
		<p
			class="mt-5 border-[1.5px] border-shop-red bg-white px-4 py-3 text-sm font-medium text-shop-red"
		>
			{form.message}
		</p>
	{/if}

	<!-- ================= Formulaire ================= -->
	{#if editing !== null}
		<Panel class="mt-6 p-5">
			<Heading size="card">{isNew ? 'Nouvelle adresse' : "Modifier l'adresse"}</Heading>

			<form
				method="POST"
				action="?/save"
				use:enhance={() =>
					async ({ result, update }) => {
						// On referme ici plutôt que dans un `$effect` : l'état suit
						// l'issue de l'envoi, il n'en dérive pas.
						if (result.type === 'success') editing = null;
						await update();
					}}
				class="mt-4 space-y-5"
			>
				{#if !isNew}
					<input type="hidden" name="id" value={(editing as Address).id} />
				{/if}

				<div>
					<Label for="label" class="mb-1.5">Libellé</Label>
					<Input id="label" name="label" value={value('label')} placeholder="Domicile, Atelier…" />
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<Label for="firstName" class="mb-1.5">Prénom *</Label>
						<Input id="firstName" name="firstName" value={value('firstName')} required />
					</div>
					<div>
						<Label for="lastName" class="mb-1.5">Nom *</Label>
						<Input id="lastName" name="lastName" value={value('lastName')} required />
					</div>
				</div>

				<div>
					<Label for="company" class="mb-1.5">Société</Label>
					<Input id="company" name="company" value={value('company')} />
				</div>

				<div>
					<Label for="line1" class="mb-1.5">Adresse *</Label>
					<Input id="line1" name="line1" value={value('line1')} required />
				</div>

				<div>
					<Label for="line2" class="mb-1.5">Complément d'adresse</Label>
					<Input id="line2" name="line2" value={value('line2')} />
				</div>

				<div class="grid gap-4 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]">
					<div>
						<Label for="postalCode" class="mb-1.5">Code postal *</Label>
						<Input id="postalCode" name="postalCode" value={value('postalCode')} required />
					</div>
					<div>
						<Label for="city" class="mb-1.5">Ville *</Label>
						<Input id="city" name="city" value={value('city')} required />
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<Label for="country" class="mb-1.5">Pays</Label>
						<Input id="country" name="country" value={value('country') || 'FR'} maxlength={2} />
					</div>
					<div>
						<Label for="phone" class="mb-1.5">Téléphone</Label>
						<Input id="phone" name="phone" type="tel" value={value('phone')} />
					</div>
				</div>

				<div class="space-y-2.5 border-t-[1.5px] border-shop-border-soft pt-4">
					<Checkbox name="isDefaultShipping" checked={(editing as Address)?.isDefaultShipping}>
						Adresse de livraison par défaut
					</Checkbox>
					<Checkbox name="isDefaultBilling" checked={(editing as Address)?.isDefaultBilling}>
						Adresse de facturation par défaut
					</Checkbox>
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

	<!-- ================= Liste ================= -->
	{#if data.addresses.length === 0}
		<!-- L'état vide reste un panneau de la page, aligné sur les autres blocs de
		     l'espace client, et porte l'action qui le fait disparaître. -->
		<Panel class="mt-6 p-6">
			<Heading size="card">Aucune adresse enregistrée</Heading>
			<p class="mt-2 max-w-[52ch] text-[14.5px] text-shop-muted">
				Enregistrez une adresse pour la retrouver automatiquement lors de vos prochaines commandes.
			</p>
			{#if editing === null}
				<div class="mt-5">
					<ShopButton variant="primary" onclick={() => (editing = {})}>
						Ajouter une adresse
					</ShopButton>
				</div>
			{/if}
		</Panel>
	{:else}
		<div class="mt-6 space-y-4">
			{#each data.addresses as item (item.id)}
				<Panel class="p-5">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								{#if item.label}
									<span class="font-display text-[15px] font-bold text-shop-ink">{item.label}</span>
								{/if}
								{#if item.isDefaultShipping}
									<span
										class="bg-shop-blue px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase"
									>
										Livraison
									</span>
								{/if}
								{#if item.isDefaultBilling}
									<span
										class="bg-shop-ink px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase"
									>
										Facturation
									</span>
								{/if}
							</div>

							<address class="mt-2 text-[14.5px] leading-relaxed text-shop-ink-soft not-italic">
								{item.firstName}
								{item.lastName}{#if item.company}<br />{item.company}{/if}<br />
								{item.line1}{#if item.line2}<br />{item.line2}{/if}<br />
								{item.postalCode}
								{item.city}{#if item.country && item.country !== 'FR'}
									— {item.country}{/if}
								{#if item.phone}<br />{item.phone}{/if}
							</address>
						</div>

						<div class="flex shrink-0 flex-wrap gap-2">
							<ShopButton
								variant="outline"
								size="sm"
								onclick={() => {
									editing = item;
									confirming = null;
								}}
							>
								Modifier
							</ShopButton>

							{#if confirming === item.id}
								<form method="POST" action="?/delete" use:enhance class="flex gap-2">
									<input type="hidden" name="id" value={item.id} />
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
								<ShopButton variant="secondary" size="sm" onclick={() => (confirming = item.id)}>
									Supprimer
								</ShopButton>
							{/if}
						</div>
					</div>
				</Panel>
			{/each}
		</div>
	{/if}
</div>

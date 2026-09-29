<script lang="ts">
	import { Checkbox, Helper, Input, Label, Radio } from 'flowbite-svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	const values = $derived(form?.values);
	const errors = $derived(form?.errors ?? {});

	/** Type de compte sélectionné : commande l'affichage des champs complémentaires. */
	let type = $state<'particulier' | 'pro' | 'collectivite'>('particulier');

	// Après un échec de validation, on rétablit le type choisi par le visiteur.
	$effect(() => {
		const submitted = form?.values?.type;
		if (submitted) type = submitted;
	});

	const accountTypes = [
		{ value: 'particulier', label: 'Particulier', hint: 'Prix TTC' },
		{ value: 'pro', label: 'Professionnel', hint: 'Prix HT, sur validation' },
		{ value: 'collectivite', label: 'Collectivité', hint: 'Mandat administratif' }
	] as const;

	/** Style v2 des champs : angles à 10 px, focus bleu de marque. */
	const inputClass =
		'rounded-[10px] border-shop-border bg-white focus:border-shop-blue focus:ring-0';
</script>

<svelte:head>
	<title>Créer un compte — MS Shop</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<Breadcrumb items={[{ label: 'Connexion', href: '/connexion' }, { label: 'Créer un compte' }]} />

{#snippet sectionTitle(step: string, label: string)}
	<div class="flex items-center gap-3">
		<span
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-shop-blue font-display text-[13px] font-extrabold text-white"
		>
			{step}
		</span>
		<Heading as="p" size="card">{label}</Heading>
	</div>
{/snippet}

<div class="mx-auto max-w-2xl">
	<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[30px]">
		Créer mon compte
	</h1>
	<p class="mt-1 text-sm text-shop-muted">
		Déjà client ?
		<a href="/connexion" class="font-semibold text-shop-blue hover:underline">Connectez-vous</a>.
	</p>

	{#if errors.form}
		<p
			class="mt-5 rounded-[10px] bg-shop-promo px-4 py-3 text-sm font-semibold text-shop-orange-deep"
		>
			{errors.form}
		</p>
	{/if}

	<form method="POST" class="mt-7 space-y-5">
		<!-- ================= Type de compte ================= -->
		<Panel padded={false} class="p-5 sm:p-6">
			<fieldset>
				<legend class="sr-only">Type de compte</legend>
				{@render sectionTitle('1', 'Type de compte')}
				<div class="mt-4 grid gap-3 sm:grid-cols-3">
					{#each accountTypes as option (option.value)}
						<label
							class="flex cursor-pointer flex-col rounded-[14px] border-[1.5px] px-4 py-3.5 transition-colors {type ===
							option.value
								? 'border-shop-blue bg-primary-50'
								: 'border-shop-border bg-white hover:border-shop-blue/50'}"
						>
							<Radio
								name="type"
								value={option.value}
								bind:group={type}
								class="text-sm font-semibold text-shop-ink"
								inputClass="border-shop-border text-shop-blue focus:ring-shop-blue"
							>
								{option.label}
							</Radio>
							<span class="mt-1 ps-6 text-xs text-shop-muted">{option.hint}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		</Panel>

		<!-- ================= Identité ================= -->
		<Panel padded={false} class="p-5 sm:p-6">
			<fieldset class="space-y-4">
				<legend class="sr-only">Vos coordonnées</legend>
				{@render sectionTitle('2', 'Vos coordonnées')}

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<Label for="firstName" class="mb-1.5">Prénom</Label>
						<Input
							id="firstName"
							name="firstName"
							autocomplete="given-name"
							required
							value={values?.firstName ?? ''}
							color={errors.firstName ? 'red' : undefined}
							class={inputClass}
						/>
						{#if errors.firstName}<Helper class="mt-1" color="red">{errors.firstName}</Helper>{/if}
					</div>

					<div>
						<Label for="lastName" class="mb-1.5">Nom</Label>
						<Input
							id="lastName"
							name="lastName"
							autocomplete="family-name"
							required
							value={values?.lastName ?? ''}
							color={errors.lastName ? 'red' : undefined}
							class={inputClass}
						/>
						{#if errors.lastName}<Helper class="mt-1" color="red">{errors.lastName}</Helper>{/if}
					</div>
				</div>

				<div>
					<Label for="email" class="mb-1.5">Adresse email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						value={values?.email ?? ''}
						color={errors.email ? 'red' : undefined}
						placeholder="vous@exemple.fr"
						class={inputClass}
					/>
					{#if errors.email}<Helper class="mt-1" color="red">{errors.email}</Helper>{/if}
				</div>

				<div>
					<Label for="phone" class="mb-1.5">
						Téléphone <span class="text-shop-muted">(facultatif)</span>
					</Label>
					<Input
						id="phone"
						name="phone"
						type="tel"
						autocomplete="tel"
						value={values?.phone ?? ''}
						class={inputClass}
					/>
				</div>
			</fieldset>
		</Panel>

		<!-- ================= Champs professionnels ================= -->
		{#if type === 'pro'}
			<Panel tone="subtle" padded={false} class="p-5 sm:p-6">
				<fieldset class="space-y-4">
					<legend class="sr-only">Votre entreprise</legend>
					<Heading as="p" size="card">Votre entreprise</Heading>

					<div>
						<Label for="companyName" class="mb-1.5">Raison sociale</Label>
						<Input
							id="companyName"
							name="companyName"
							autocomplete="organization"
							value={values?.companyName ?? ''}
							color={errors.companyName ? 'red' : undefined}
							class={inputClass}
						/>
						{#if errors.companyName}
							<Helper class="mt-1" color="red">{errors.companyName}</Helper>
						{/if}
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<Label for="siret" class="mb-1.5">SIRET</Label>
							<Input
								id="siret"
								name="siret"
								inputmode="numeric"
								value={values?.siret ?? ''}
								color={errors.siret ? 'red' : undefined}
								placeholder="14 chiffres"
								class={inputClass}
							/>
							{#if errors.siret}<Helper class="mt-1" color="red">{errors.siret}</Helper>{/if}
						</div>

						<div>
							<Label for="vatNumber" class="mb-1.5">
								TVA intracommunautaire <span class="text-shop-muted">(facultatif)</span>
							</Label>
							<Input
								id="vatNumber"
								name="vatNumber"
								value={values?.vatNumber ?? ''}
								color={errors.vatNumber ? 'red' : undefined}
								placeholder="FR12345678901"
								class={inputClass}
							/>
							{#if errors.vatNumber}<Helper class="mt-1" color="red">{errors.vatNumber}</Helper
								>{/if}
						</div>
					</div>

					<p class="text-xs text-shop-muted">
						Votre compte sera vérifié par notre équipe avant l'accès aux tarifs professionnels.
					</p>
				</fieldset>
			</Panel>
		{/if}

		<!-- ================= Champs collectivité ================= -->
		{#if type === 'collectivite'}
			<Panel tone="subtle" padded={false} class="p-5 sm:p-6">
				<fieldset class="space-y-4">
					<legend class="sr-only">Votre collectivité</legend>
					<Heading as="p" size="card">Votre collectivité</Heading>

					<div>
						<Label for="collectivityName" class="mb-1.5">Nom de la collectivité</Label>
						<Input
							id="collectivityName"
							name="collectivityName"
							value={values?.collectivityName ?? ''}
							color={errors.collectivityName ? 'red' : undefined}
							placeholder="Commune de…"
							class={inputClass}
						/>
						{#if errors.collectivityName}
							<Helper class="mt-1" color="red">{errors.collectivityName}</Helper>
						{/if}
					</div>

					<p class="text-xs text-shop-muted">
						Votre compte sera vérifié par notre équipe avant l'accès au mandat administratif.
					</p>
				</fieldset>
			</Panel>
		{/if}

		<!-- ================= Mot de passe ================= -->
		<Panel padded={false} class="p-5 sm:p-6">
			<fieldset>
				<legend class="sr-only">Votre mot de passe</legend>
				{@render sectionTitle('3', 'Votre mot de passe')}
				<div class="mt-4">
					<Label for="password" class="mb-1.5">Mot de passe</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
						minlength={8}
						color={errors.password ? 'red' : undefined}
						class={inputClass}
					/>
					{#if errors.password}
						<Helper class="mt-1" color="red">{errors.password}</Helper>
					{:else}
						<Helper class="mt-1">8 caractères minimum.</Helper>
					{/if}
				</div>
			</fieldset>
		</Panel>

		<Checkbox name="newsletter" checked={values?.newsletter ?? false}>
			<span class="text-sm text-shop-muted">
				Je souhaite recevoir les offres et nouveautés de MS Shop.
			</span>
		</Checkbox>

		<ShopButton type="submit" size="lg" class="w-full sm:w-auto">Créer mon compte</ShopButton>
	</form>
</div>

<script lang="ts">
	import { Checkbox, Helper, Input, Label, Radio } from 'flowbite-svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
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
</script>

<svelte:head>
	<title>Créer un compte — MS Shop</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<Breadcrumb items={[{ label: 'Connexion', href: '/connexion' }, { label: 'Créer un compte' }]} />

<div class="mx-auto max-w-2xl">
	<h1 class="font-display text-2xl font-extrabold tracking-tight text-shop-ink">
		Créer mon compte
	</h1>
	<p class="mt-1 text-sm text-shop-muted">
		Déjà client ?
		<a href="/connexion" class="font-semibold text-shop-blue hover:underline">Connectez-vous</a>.
	</p>

	{#if errors.form}
		<p class="mt-5 border border-shop-red bg-white px-4 py-3 text-sm font-medium text-shop-red">
			{errors.form}
		</p>
	{/if}

	<form method="POST" class="mt-7 space-y-7">
		<!-- ================= Type de compte ================= -->
		<fieldset>
			<Heading as="p" size="label">Type de compte</Heading>
			<div class="mt-3 grid gap-3 sm:grid-cols-3">
				{#each accountTypes as option (option.value)}
					<label
						class="flex cursor-pointer flex-col border-[1.5px] px-4 py-3 transition-colors {type ===
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

		<!-- ================= Identité ================= -->
		<fieldset class="space-y-4">
			<legend class="font-display text-sm font-bold tracking-wide text-shop-ink uppercase"
				>Vos coordonnées</legend
			>

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
						class="rounded-none"
						wrapperClass="rounded-none"
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
						class="rounded-none"
						wrapperClass="rounded-none"
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
					class="rounded-none"
					wrapperClass="rounded-none"
				/>
				{#if errors.email}<Helper class="mt-1" color="red">{errors.email}</Helper>{/if}
			</div>

			<div>
				<Label for="phone" class="mb-1.5"
					>Téléphone <span class="text-shop-muted">(facultatif)</span></Label
				>
				<Input
					id="phone"
					name="phone"
					type="tel"
					autocomplete="tel"
					value={values?.phone ?? ''}
					class="rounded-none"
					wrapperClass="rounded-none"
				/>
			</div>
		</fieldset>

		<!-- ================= Champs professionnels ================= -->
		{#if type === 'pro'}
			<fieldset class="space-y-4 border-[1.5px] border-shop-border bg-shop-subtle p-5">
				<legend class="px-1 text-sm font-bold tracking-wide text-shop-ink uppercase">
					Votre entreprise
				</legend>

				<div>
					<Label for="companyName" class="mb-1.5">Raison sociale</Label>
					<Input
						id="companyName"
						name="companyName"
						autocomplete="organization"
						value={values?.companyName ?? ''}
						color={errors.companyName ? 'red' : undefined}
						class="rounded-none"
						wrapperClass="rounded-none"
					/>
					{#if errors.companyName}<Helper class="mt-1" color="red">{errors.companyName}</Helper
						>{/if}
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
							class="rounded-none"
							wrapperClass="rounded-none"
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
							class="rounded-none"
							wrapperClass="rounded-none"
						/>
						{#if errors.vatNumber}<Helper class="mt-1" color="red">{errors.vatNumber}</Helper>{/if}
					</div>
				</div>

				<p class="text-xs text-shop-muted">
					Votre compte sera vérifié par notre équipe avant l'accès aux tarifs professionnels.
				</p>
			</fieldset>
		{/if}

		<!-- ================= Champs collectivité ================= -->
		{#if type === 'collectivite'}
			<fieldset class="space-y-4 border-[1.5px] border-shop-border bg-shop-subtle p-5">
				<legend class="px-1 text-sm font-bold tracking-wide text-shop-ink uppercase">
					Votre collectivité
				</legend>

				<div>
					<Label for="collectivityName" class="mb-1.5">Nom de la collectivité</Label>
					<Input
						id="collectivityName"
						name="collectivityName"
						value={values?.collectivityName ?? ''}
						color={errors.collectivityName ? 'red' : undefined}
						placeholder="Commune de…"
						class="rounded-none"
						wrapperClass="rounded-none"
					/>
					{#if errors.collectivityName}
						<Helper class="mt-1" color="red">{errors.collectivityName}</Helper>
					{/if}
				</div>

				<p class="text-xs text-shop-muted">
					Votre compte sera vérifié par notre équipe avant l'accès au mandat administratif.
				</p>
			</fieldset>
		{/if}

		<!-- ================= Mot de passe ================= -->
		<fieldset>
			<Heading as="p" size="label">Votre mot de passe</Heading>
			<div class="mt-3">
				<Label for="password" class="mb-1.5">Mot de passe</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					required
					minlength={8}
					color={errors.password ? 'red' : undefined}
					class="rounded-none"
					wrapperClass="rounded-none"
				/>
				{#if errors.password}
					<Helper class="mt-1" color="red">{errors.password}</Helper>
				{:else}
					<Helper class="mt-1">8 caractères minimum.</Helper>
				{/if}
			</div>
		</fieldset>

		<Checkbox name="newsletter" checked={values?.newsletter ?? false}>
			<span class="text-sm text-shop-muted">
				Je souhaite recevoir les offres et nouveautés de MS Shop.
			</span>
		</Checkbox>

		<ShopButton type="submit" size="lg" class="w-full sm:w-auto">Créer mon compte</ShopButton>
	</form>
</div>

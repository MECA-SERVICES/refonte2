<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { ArrowRightToBracketOutline } from 'flowbite-svelte-icons';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const TYPE_LABELS: Record<string, string> = {
		particulier: 'Particulier',
		pro: 'Professionnel',
		collectivite: 'Collectivité'
	};

	const STATUS_LABELS: Record<string, string> = {
		validated: 'Compte actif',
		pending: 'En attente de validation',
		rejected: 'Dossier refusé'
	};
</script>

<svelte:head>
	<title>Mon compte — MS Shop</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte' }]} />

<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[32px]">
	Mon compte
</h1>

{#if data.justRegistered}
	<p
		class="mt-5 border border-shop-blue bg-primary-50 px-4 py-3 text-sm font-medium text-primary-800"
	>
		Votre compte est créé. Notre équipe vérifie vos informations avant de vous donner accès aux
		conditions tarifaires dédiées ; vous pouvez déjà commander aux tarifs standard.
	</p>
{/if}

<div class="mt-8 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
	<!-- ================= Coordonnées ================= -->
	<Panel padded={false} class="p-6">
		<Heading size="card">Mes informations</Heading>

		{#if data.profile}
			<dl class="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
				<div>
					<dt class="text-xs tracking-wide text-shop-muted uppercase">Nom</dt>
					<dd class="mt-0.5 font-semibold text-shop-ink">
						{data.profile.firstName}
						{data.profile.lastName}
					</dd>
				</div>
				<div>
					<dt class="text-xs tracking-wide text-shop-muted uppercase">Email</dt>
					<dd class="mt-0.5 font-semibold break-all text-shop-ink">{data.account.email}</dd>
				</div>
				{#if data.profile.phone}
					<div>
						<dt class="text-xs tracking-wide text-shop-muted uppercase">Téléphone</dt>
						<dd class="mt-0.5 font-semibold text-shop-ink">{data.profile.phone}</dd>
					</div>
				{/if}
				<div>
					<dt class="text-xs tracking-wide text-shop-muted uppercase">Type de compte</dt>
					<dd class="mt-0.5 font-semibold text-shop-ink">
						{TYPE_LABELS[data.profile.type] ?? data.profile.type}
					</dd>
				</div>

				{#if data.profile.companyName}
					<div>
						<dt class="text-xs tracking-wide text-shop-muted uppercase">Raison sociale</dt>
						<dd class="mt-0.5 font-semibold text-shop-ink">{data.profile.companyName}</dd>
					</div>
				{/if}
				{#if data.profile.siret}
					<div>
						<dt class="text-xs tracking-wide text-shop-muted uppercase">SIRET</dt>
						<dd class="mt-0.5 font-semibold text-shop-ink">{data.profile.siret}</dd>
					</div>
				{/if}
				{#if data.profile.collectivityName}
					<div>
						<dt class="text-xs tracking-wide text-shop-muted uppercase">Collectivité</dt>
						<dd class="mt-0.5 font-semibold text-shop-ink">{data.profile.collectivityName}</dd>
					</div>
				{/if}
			</dl>

			{#if data.profile.type !== 'particulier'}
				<p
					class="mt-5 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold {data.profile
						.status === 'validated'
						? 'bg-green-50 text-green-700'
						: data.profile.status === 'rejected'
							? 'bg-red-50 text-shop-red'
							: 'bg-shop-subtle text-shop-ink'}"
				>
					{STATUS_LABELS[data.profile.status] ?? data.profile.status}
				</p>
			{/if}
		{:else}
			<p class="mt-4 text-sm text-shop-muted">
				Aucune fiche client n'est encore rattachée à ce compte.
			</p>
		{/if}

		<p class="mt-6 text-xs text-shop-muted">
			La modification de vos informations et le carnet d'adresses arrivent prochainement.
		</p>
	</Panel>

	<!-- ================= Actions ================= -->
	<Panel padded={false} class="p-6">
		<Heading size="card">Raccourcis</Heading>

		<div class="mt-4 space-y-2">
			<a
				href="/panier"
				class="block border border-shop-border bg-white px-4 py-3 text-sm font-semibold text-shop-ink hover:text-shop-blue"
			>
				Mon panier
			</a>
			<a
				href="/recherche"
				class="block border border-shop-border bg-white px-4 py-3 text-sm font-semibold text-shop-ink hover:text-shop-blue"
			>
				Continuer mes achats
			</a>
		</div>

		<form method="POST" action="/deconnexion" class="mt-5">
			<input type="hidden" name="redirectTo" value="/" />
			<Button type="submit" color="alternative" size="sm" class="w-full">
				<ArrowRightToBracketOutline class="me-2 h-4 w-4" /> Déconnexion
			</Button>
		</form>
	</Panel>
</div>

<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import DescriptionItem from '$lib/components/shop/DescriptionItem.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import { formatPrice } from '$lib/shop';
	import { priceSuffix } from '$lib/tax';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});

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

<div class="mt-8">
	<!-- ================= Coordonnées ================= -->
	<Panel padded={false} class="p-6">
		<Heading size="card">Mes informations</Heading>

		{#if data.profile}
			<dl class="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
				<DescriptionItem label="Nom"
					>{data.profile.firstName}
					{data.profile.lastName}</DescriptionItem
				>
				<DescriptionItem label="Email">{data.account.email}</DescriptionItem>
				{#if data.profile.phone}
					<DescriptionItem label="Téléphone">{data.profile.phone}</DescriptionItem>
				{/if}
				<DescriptionItem label="Type de compte"
					>{TYPE_LABELS[data.profile.type] ?? data.profile.type}</DescriptionItem
				>

				{#if data.profile.companyName}
					<DescriptionItem label="Raison sociale">{data.profile.companyName}</DescriptionItem>
				{/if}
				{#if data.profile.siret}
					<DescriptionItem label="SIRET">{data.profile.siret}</DescriptionItem>
				{/if}
				{#if data.profile.collectivityName}
					<DescriptionItem label="Collectivité">{data.profile.collectivityName}</DescriptionItem>
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
			La modification de vos informations arrive prochainement.
		</p>
	</Panel>

	<!-- ================= Dernières commandes ================= -->
	<Panel padded={false} class="mt-6 p-6">
		<div class="flex flex-wrap items-baseline justify-between gap-3">
			<Heading size="card">Dernières commandes</Heading>
			{#if data.recentOrders.length > 0}
				<a
					href="/compte/commandes"
					class="text-[13.5px] font-semibold text-shop-blue hover:underline"
				>
					Tout voir →
				</a>
			{/if}
		</div>

		{#if data.recentOrders.length === 0}
			<p class="mt-4 text-sm text-shop-muted">Vous n'avez pas encore passé de commande.</p>
		{:else}
			<ul class="mt-4 divide-y divide-shop-border-soft">
				{#each data.recentOrders as item (item.id)}
					<li class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
						<div class="min-w-0">
							<a
								href="/compte/commandes/{item.id}"
								class="font-semibold text-shop-ink hover:text-shop-blue"
							>
								{item.reference}
							</a>
							<p class="mt-0.5 text-[13px] text-shop-muted">
								{dateFormat.format(item.createdAt)} · {item.stateLabel}
							</p>
						</div>
						<p class="shrink-0 font-display font-bold text-shop-ink">
							{formatPrice(data.tax.displayMode === 'ht' ? item.totalHt : item.totalTtc)}
							<span class="text-[12px] font-bold text-shop-muted">
								{priceSuffix(data.tax.displayMode)}
							</span>
						</p>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
</div>

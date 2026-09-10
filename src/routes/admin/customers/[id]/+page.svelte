<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Button, Card } from 'flowbite-svelte';
	import { EditOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		ConfirmDialog,
		CUSTOMER_TYPE_BADGES,
		CUSTOMER_STATUS_BADGES
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const c = $derived(data.customer);
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const dayFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
	const shortFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	const fullName = $derived(`${c.firstName} ${c.lastName}`.trim());

	/** Initiales de l'avatar : repère visuel immédiat dans une liste de fiches. */
	const initials = $derived(
		`${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() || '?'
	);

	const typeBadge = $derived(
		CUSTOMER_TYPE_BADGES[c.type ?? ''] ?? { label: c.type, color: 'gray' }
	);
	const statusBadge = $derived(
		CUSTOMER_STATUS_BADGES[c.status ?? ''] ?? { label: c.status, color: 'gray' }
	);

	/** Un dossier professionnel en attente appelle une décision (CDC 08, R2). */
	const awaitingReview = $derived(c.status === 'pending');

	const revenue = $derived(Number(data.totals?.revenue ?? 0));
	const orderCount = $derived(data.totals?.count ?? 0);

	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);

	const confirmDelete = () => deleteForm?.requestSubmit();
</script>

<svelte:head><title>{fullName} · Clients</title></svelte:head>

<PageHeader
	title={fullName}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Clients', href: '/admin/customers' },
		{ label: fullName }
	]}
>
	{#snippet actions()}
		<Button color="alternative" href={resolve('/admin/customers/[id]/edit', { id: String(c.id) })}>
			<EditOutline class="me-2 h-4 w-4" /> Éditer
		</Button>
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<!-- ================= Identité ================= -->
<!--
	L'en-tête réunit ce qui identifie le client et ce qui qualifie la relation :
	type de compte, statut de validation, ancienneté. Ces informations étaient
	dispersées dans les listes de définition et se lisaient mal.
-->
<Card class="mb-6 max-w-none p-6">
	<div class="flex flex-wrap items-start gap-5">
		<div
			class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-200"
			aria-hidden="true"
		>
			{initials}
		</div>

		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white">{fullName}</h2>
				<Badge color={typeBadge.color}>{typeBadge.label}</Badge>
				<Badge color={statusBadge.color}>{statusBadge.label}</Badge>
			</div>

			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				<a href="mailto:{c.email}" class="hover:underline">{c.email}</a>
				{#if c.phone}· <a href="tel:{c.phone}" class="hover:underline">{c.phone}</a>{/if}
				· Client depuis le {dayFmt.format(new Date(c.createdAt))}
			</p>

			{#if c.companyName}
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
					{c.companyName}{#if c.siret}
						· SIRET {c.siret}{/if}
				</p>
			{/if}
		</div>
	</div>

	{#if awaitingReview}
		<!-- Le dossier attend une décision : le signaler ici évite qu'il se perde
		     au milieu des informations de contact (R2, R9). -->
		<p
			class="mt-5 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
		>
			<span class="font-semibold">Dossier en attente de validation.</span>
			Tant qu'il n'est pas traité, ce client voit les prix TTC et n'accède pas aux conditions professionnelles.
		</p>
	{/if}
</Card>

<!-- ================= Chiffres clés ================= -->
<div class="mb-6 grid gap-4 sm:grid-cols-3">
	<Card class="max-w-none p-4">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Commandes
		</p>
		<p class="mt-1 text-2xl font-bold text-gray-900 tabular-nums dark:text-white">{orderCount}</p>
	</Card>

	<Card class="max-w-none p-4">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Chiffre d'affaires TTC
		</p>
		<p class="mt-1 text-2xl font-bold text-gray-900 tabular-nums dark:text-white">
			{eur.format(revenue)}
		</p>
	</Card>

	<Card class="max-w-none p-4">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Dernière commande
		</p>
		<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
			{data.totals?.lastAt ? shortFmt.format(new Date(data.totals.lastAt)) : '—'}
		</p>
	</Card>
</div>

<div class="grid gap-6 lg:grid-cols-3">
	<!-- ================= Colonne principale ================= -->
	<div class="space-y-6 lg:col-span-2">
		<!-- Commandes -->
		<Card class="max-w-none p-6">
			<div class="mb-4 flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">
					Commandes <span class="font-normal text-gray-400">({orderCount})</span>
				</h2>
				{#if orderCount > data.orders.length}
					<span class="text-xs text-gray-500">
						{data.orders.length} plus récentes affichées
					</span>
				{/if}
			</div>

			{#if data.orders.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">Aucune commande passée.</p>
			{:else}
				<ul class="divide-y divide-gray-100 dark:divide-gray-800">
					{#each data.orders as o (o.id)}
						<li class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
							<div class="min-w-0">
								<a
									href={resolve('/admin/orders/[id]', { id: String(o.id) })}
									class="font-medium text-primary-700 hover:underline dark:text-primary-400"
								>
									{o.reference}
								</a>
								<p class="mt-0.5 text-xs text-gray-500">
									{shortFmt.format(new Date(o.createdAt))} · {o.stateLabel}
								</p>
							</div>
							<span class="font-semibold text-gray-900 tabular-nums dark:text-white">
								{eur.format(Number(o.totalTtc))}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		<!-- Adresses -->
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">
				Adresses <span class="font-normal text-gray-400">({c.addresses.length})</span>
			</h2>

			{#if c.addresses.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">Aucune adresse enregistrée.</p>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2">
					{#each c.addresses as addr (addr.id)}
						<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
							<div class="mb-2 flex flex-wrap items-center gap-2">
								<span class="text-sm font-medium text-gray-900 dark:text-white">
									{addr.label ?? 'Adresse'}
								</span>
								{#if addr.isDefaultShipping}<Badge color="blue">Livraison</Badge>{/if}
								{#if addr.isDefaultBilling}<Badge color="gray">Facturation</Badge>{/if}
							</div>
							<address class="text-sm leading-relaxed text-gray-600 not-italic dark:text-gray-300">
								{addr.firstName}
								{addr.lastName}{#if addr.company}<br />{addr.company}{/if}<br />
								{addr.line1}{#if addr.line2}<br />{addr.line2}{/if}<br />
								{addr.postalCode}
								{addr.city}{#if addr.country && addr.country !== 'FR'}<br />{addr.country}{/if}
							</address>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	</div>

	<!-- ================= Colonne latérale ================= -->
	<div class="space-y-6">
		<!-- Fiscalité : décide du taux appliqué et du mode d'affichage (CDC 23). -->
		<Card class="max-w-none p-6">
			<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Fiscalité</h2>
			<dl class="space-y-2.5 text-sm">
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Pays de facturation</dt>
					<dd class="font-medium text-gray-900 dark:text-white">{c.billingCountry ?? 'FR'}</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">N° TVA</dt>
					<dd class="font-medium text-gray-900 dark:text-white">{c.vatNumber ?? '—'}</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Régime</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{c.taxExemptStatus === 'exempt_eu_b2b' ? 'Autoliquidation' : 'Standard'}
					</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Prix affichés</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{c.type === 'pro' || c.type === 'professional' || c.type === 'collectivite'
							? 'HT'
							: 'TTC'}
					</dd>
				</div>
			</dl>
		</Card>

		<!-- Note interne : jamais exposée au client (R13). -->
		<Card class="max-w-none p-6">
			<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Note interne</h2>
			{#if c.privateNote}
				<p class="text-sm leading-relaxed whitespace-pre-line text-gray-700 dark:text-gray-300">
					{c.privateNote}
				</p>
			{:else}
				<p class="text-sm text-gray-500">Aucune note.</p>
			{/if}
			<p class="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800">
				Visible uniquement en back-office.
			</p>
		</Card>

		<!-- Divers -->
		<Card class="max-w-none p-6">
			<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Informations</h2>
			<dl class="space-y-2.5 text-sm">
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Newsletter</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{c.newsletterSubscribed ? 'Inscrit' : 'Non inscrit'}
					</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Origine</dt>
					<dd class="font-medium text-gray-900 dark:text-white">{c.source ?? '—'}</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Facturation</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{c.invoiceFormat === 'proforma' ? 'Proforma' : 'Standard'}
					</dd>
				</div>
				{#if c.legacyPsId}
					<div class="flex justify-between gap-4">
						<dt class="text-gray-500">Réf. PrestaShop</dt>
						<dd class="font-medium text-gray-900 tabular-nums dark:text-white">{c.legacyPsId}</dd>
					</div>
				{/if}
			</dl>
		</Card>
	</div>
</div>

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le client"
	message="Cette action est irréversible. Le client et ses adresses seront supprimés."
	confirmLabel="Supprimer"
	onconfirm={confirmDelete}
/>

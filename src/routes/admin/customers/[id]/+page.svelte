<script lang="ts">
	import { Button, Card } from 'flowbite-svelte';
	import { EditOutline, TrashBinOutline, MapPinAltSolid } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		StatusBadge,
		ConfirmDialog,
		CUSTOMER_TYPE_BADGES,
		CUSTOMER_STATUS_BADGES
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const c = $derived(data.customer);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);

	function confirmDelete() {
		deleteForm?.requestSubmit();
	}
</script>

<svelte:head><title>{c.firstName} {c.lastName} · Clients</title></svelte:head>

<PageHeader
	title="{c.firstName} {c.lastName}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Clients', href: '/admin/customers' },
		{ label: `${c.firstName} ${c.lastName}` }
	]}
>
	{#snippet actions()}
		<Button color="alternative" href="/admin/customers/{c.id}/edit">
			<EditOutline class="me-2 h-4 w-4" /> Éditer
		</Button>
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<div class="grid gap-6 lg:grid-cols-3">
	<Card class="p-6 lg:col-span-2">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Coordonnées</h2>
		<dl class="grid gap-4 sm:grid-cols-2">
			<div>
				<dt class="text-sm text-gray-500 dark:text-gray-400">Email</dt>
				<dd class="text-gray-900 dark:text-white">{c.email}</dd>
			</div>
			<div>
				<dt class="text-sm text-gray-500 dark:text-gray-400">Téléphone</dt>
				<dd class="text-gray-900 dark:text-white">{c.phone ?? '—'}</dd>
			</div>
			{#if c.companyName}
				<div>
					<dt class="text-sm text-gray-500 dark:text-gray-400">Société</dt>
					<dd class="text-gray-900 dark:text-white">{c.companyName}</dd>
				</div>
			{/if}
			{#if c.siret}
				<div>
					<dt class="text-sm text-gray-500 dark:text-gray-400">SIRET</dt>
					<dd class="text-gray-900 dark:text-white">{c.siret}</dd>
				</div>
			{/if}
		</dl>

		{#if c.privateNote}
			<div class="mt-4">
				<dt class="text-sm text-gray-500 dark:text-gray-400">Note privée</dt>
				<dd class="whitespace-pre-line text-gray-900 dark:text-white">{c.privateNote}</dd>
			</div>
		{/if}
	</Card>

	<Card class="p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Récapitulatif</h2>
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-500 dark:text-gray-400">Type</span>
				<StatusBadge value={c.type} map={CUSTOMER_TYPE_BADGES} />
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-500 dark:text-gray-400">Statut</span>
				<StatusBadge value={c.status} map={CUSTOMER_STATUS_BADGES} />
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-500 dark:text-gray-400">Total achats</span>
				<span class="font-medium text-gray-900 dark:text-white">{c.totalSpent} €</span>
			</div>
		</div>
	</Card>
</div>

<Card class="mt-6 max-w-none p-6">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
			Adresses ({c.addresses.length})
		</h2>
	</div>

	{#if c.addresses.length === 0}
		<p class="py-4 text-center text-gray-500 dark:text-gray-400">Aucune adresse enregistrée.</p>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each c.addresses as addr (addr.id)}
				<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
					<div class="mb-2 flex items-center gap-2">
						<MapPinAltSolid class="h-4 w-4 text-gray-400" />
						<span class="font-medium text-gray-900 dark:text-white">{addr.label ?? 'Adresse'}</span>
					</div>
					<address class="text-sm text-gray-600 not-italic dark:text-gray-300">
						{addr.firstName}
						{addr.lastName}<br />
						{#if addr.company}{addr.company}<br />{/if}
						{addr.line1}<br />
						{#if addr.line2}{addr.line2}<br />{/if}
						{addr.postalCode}
						{addr.city}<br />
						{addr.country}
					</address>
				</div>
			{/each}
		</div>
	{/if}
</Card>

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le client"
	message="Cette action est irréversible. Le client et ses adresses seront supprimés."
	confirmLabel="Supprimer"
	onconfirm={confirmDelete}
/>

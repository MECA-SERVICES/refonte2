<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { goto } from '$app/navigation';
	import { Button, Card, Input, Label } from 'flowbite-svelte';
	import { PageHeader, StateBadge, listFilterHref } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Nouvelle facture comptoir : on choisit le client (recherche par nom,
	 * société, e-mail ou téléphone), ou on crée un client de passage sans compte
	 * web. La facture s'ouvre aussitôt en brouillon.
	 */

	let { data }: PageProps = $props();

	let timer: ReturnType<typeof setTimeout> | undefined;
	function search(value: string) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			goto(listFilterHref('/admin/invoices/new', [['client', value.trim()]]), {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}, 300);
	}
</script>

<svelte:head><title>Nouvelle facture · Administration</title></svelte:head>

<PageHeader
	title="Nouvelle facture"
	subtitle="Choisissez le client : la facture s'ouvre en brouillon"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Factures comptoir', href: '/admin/invoices' },
		{ label: 'Nouvelle facture' }
	]}
/>

<div class="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
	<Card class="max-w-none p-5">
		<label for="client-search" class="mb-2 block text-sm font-semibold text-gray-900">
			Client existant
		</label>
		<input
			id="client-search"
			type="search"
			value={data.term}
			oninput={(e) => search(e.currentTarget.value)}
			placeholder="Nom, société, e-mail ou téléphone"
			autocomplete="off"
			class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
		/>
		{#if data.term.trim().length >= 2}
			<ul class="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
				{#each data.customers as c (c.id)}
					<li class="flex items-center gap-3 p-3 text-sm">
						<div class="min-w-0 flex-1">
							<p class="font-medium text-gray-900">
								{c.companyName ? `${c.companyName} · ` : ''}{c.firstName}
								{c.lastName}
							</p>
							<p class="text-xs text-gray-500">
								{[c.email, c.phone].filter(Boolean).join(' · ') || 'Ni e-mail ni téléphone'}
							</p>
						</div>
						{#if !c.userId}<StateBadge color="gray" label="Sans compte web" />{/if}
						<form method="POST" action="?/create" use:enhance data-feedback="errors">
							<input type="hidden" name="customerId" value={c.id} />
							<Button type="submit" size="xs">Facturer</Button>
						</form>
					</li>
				{:else}
					<li class="p-3 text-sm text-gray-500">Aucun client : créez-le à droite.</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card class="max-w-none p-5">
		<h2 class="mb-1 text-sm font-semibold text-gray-900">Client de passage</h2>
		<p class="mb-4 text-xs text-gray-500">Créé sans compte web : l'e-mail est facultatif.</p>
		<form
			method="POST"
			action="?/createCustomer"
			use:enhance
			data-feedback="errors"
			class="space-y-3"
		>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<Label for="new-first" class="mb-1 text-xs">Prénom</Label>
					<Input id="new-first" name="firstName" size="sm" />
				</div>
				<div>
					<Label for="new-last" class="mb-1 text-xs">Nom</Label>
					<Input id="new-last" name="lastName" size="sm" />
				</div>
			</div>
			<div>
				<Label for="new-company" class="mb-1 text-xs">Société (facultatif)</Label>
				<Input id="new-company" name="companyName" size="sm" />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<Label for="new-phone" class="mb-1 text-xs">Téléphone</Label>
					<Input id="new-phone" name="phone" size="sm" />
				</div>
				<div>
					<Label for="new-email" class="mb-1 text-xs">E-mail</Label>
					<Input id="new-email" name="email" type="email" size="sm" />
				</div>
			</div>
			<Button type="submit" class="w-full">Créer et facturer</Button>
		</form>
	</Card>
</div>

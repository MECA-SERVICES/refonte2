<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input, Label, Select } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import type { Contact } from '$lib/server/db/contact.schema';

	/**
	 * Interlocuteurs d'un client pro ou d'un fournisseur : nom, fonction,
	 * e-mail, téléphones. Chaque contact se modifie sur place ; la page porte les
	 * actions `?/addContact`, `?/updateContact` et `?/deleteContact`.
	 */

	let { contacts }: { contacts: Contact[] } = $props();

	const CIVILITIES = [
		{ value: '', name: '—' },
		{ value: 'M.', name: 'M.' },
		{ value: 'Mme', name: 'Mme' }
	];

	let editing = $state<number | null>(null);
	let adding = $state(false);
</script>

{#snippet fields(c: Partial<Contact>, prefix: string)}
	<div class="grid gap-2 sm:grid-cols-2">
		<div class="sm:col-span-2">
			<Label for="{prefix}-civility" class="mb-1 text-xs">Civilité</Label>
			<Select
				id="{prefix}-civility"
				name="civility"
				size="sm"
				placeholder=""
				items={CIVILITIES}
				value={c.civility ?? ''}
				class="w-28"
			/>
		</div>
		<div>
			<Label for="{prefix}-first" class="mb-1 text-xs">Prénom</Label>
			<Input id="{prefix}-first" name="firstName" size="sm" value={c.firstName ?? ''} />
		</div>
		<div>
			<Label for="{prefix}-last" class="mb-1 text-xs">Nom ou service</Label>
			<Input id="{prefix}-last" name="lastName" size="sm" required value={c.lastName ?? ''} />
		</div>
		<div class="sm:col-span-2">
			<Label for="{prefix}-role" class="mb-1 text-xs">Fonction</Label>
			<Input
				id="{prefix}-role"
				name="role"
				size="sm"
				value={c.role ?? ''}
				placeholder="Facturation, commercial…"
			/>
		</div>
		<div class="sm:col-span-2">
			<Label for="{prefix}-email" class="mb-1 text-xs">E-mail</Label>
			<Input id="{prefix}-email" name="email" type="email" size="sm" value={c.email ?? ''} />
		</div>
		<div>
			<Label for="{prefix}-phone" class="mb-1 text-xs">Téléphone</Label>
			<Input id="{prefix}-phone" name="phone" size="sm" value={c.phone ?? ''} />
		</div>
		<div>
			<Label for="{prefix}-mobile" class="mb-1 text-xs">Portable</Label>
			<Input id="{prefix}-mobile" name="mobile" size="sm" value={c.mobile ?? ''} />
		</div>
	</div>
{/snippet}

<Card class="max-w-none p-6">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-900">Contacts ({contacts.length})</h2>
		{#if !adding}
			<Button size="xs" color="alternative" onclick={() => (adding = true)}>
				<PlusOutline class="me-1 h-3.5 w-3.5" /> Ajouter
			</Button>
		{/if}
	</div>

	{#if adding}
		<form
			method="POST"
			action="?/addContact"
			use:enhance={() =>
				async ({ result, update }) => {
					await update();
					if (result.type === 'success') adding = false;
				}}
			data-success="Contact ajouté."
			class="mb-4 rounded-lg border border-gray-200 p-3"
		>
			{@render fields({}, 'new-contact')}
			<div class="mt-3 flex gap-2">
				<Button type="submit" size="xs">Ajouter le contact</Button>
				<Button size="xs" color="alternative" onclick={() => (adding = false)}>Annuler</Button>
			</div>
		</form>
	{/if}

	{#if contacts.length === 0 && !adding}
		<p class="text-sm text-gray-500">Aucun contact.</p>
	{:else}
		<ul class="divide-y divide-gray-100">
			{#each contacts as c (c.id)}
				<li class="py-2.5 text-sm">
					{#if editing === c.id}
						<form
							method="POST"
							action="?/updateContact"
							use:enhance={() =>
								async ({ result, update }) => {
									await update({ reset: false });
									if (result.type === 'success') editing = null;
								}}
							data-success="Contact enregistré."
						>
							<input type="hidden" name="contactId" value={c.id} />
							{@render fields(c, `contact-${c.id}`)}
							<div class="mt-3 flex gap-2">
								<Button type="submit" size="xs">Enregistrer</Button>
								<Button size="xs" color="alternative" onclick={() => (editing = null)}
									>Annuler</Button
								>
								<Button
									type="submit"
									formaction="?/deleteContact"
									size="xs"
									color="red"
									class="ms-auto">Supprimer</Button
								>
							</div>
						</form>
					{:else}
						{@const phones = [c.phone, c.mobile].filter(Boolean).join(' · ')}
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="font-medium text-gray-900">
									{[c.civility, c.firstName, c.lastName].filter(Boolean).join(' ')}
									{#if c.role}<span class="font-normal text-gray-500"> · {c.role}</span>{/if}
								</p>
								<p class="text-xs text-gray-600">
									{#if c.email}<a href="mailto:{c.email}" class="hover:underline">{c.email}</a
										>{/if}{c.email && phones ? ' · ' : ''}{phones}
								</p>
							</div>
							<Button size="xs" color="alternative" onclick={() => (editing = c.id)}
								>Modifier</Button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</Card>

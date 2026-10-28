<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Card, Label, Input, Select, Textarea, Button, Checkbox, Alert } from 'flowbite-svelte';
	import type { Customer } from '$lib/server/db/customer.schema';

	let {
		customer,
		message,
		submitLabel = 'Enregistrer'
	}: {
		customer?: Partial<Customer>;
		message?: string;
		submitLabel?: string;
	} = $props();

	const typeOptions = [
		{ value: 'particulier', name: 'Particulier' },
		{ value: 'entreprise', name: 'Entreprise' },
		{ value: 'collectivite', name: 'Collectivité' }
	];

	const statusOptions = [
		{ value: 'pending', name: 'En attente' },
		{ value: 'validated', name: 'Validé' },
		{ value: 'rejected', name: 'Rejeté' }
	];

	let type = $derived(customer?.type ?? 'particulier');
	const isCompany = $derived(type === 'entreprise' || type === 'collectivite');

	/*
	 * Client sans compte web (client du comptoir, forme reprise des tiers
	 * Dolibarr) : l'e-mail devient facultatif. Le choix se fait à la création ;
	 * un client existant sans compte le reste.
	 */
	const isNew = $derived(!customer?.id);
	let withoutAccount = $derived(!isNew && !customer?.userId);
</script>

<form method="POST" use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Identité</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="firstName" class="mb-2">Prénom</Label>
				<Input id="firstName" name="firstName" required value={customer?.firstName ?? ''} />
			</div>
			<div>
				<Label for="lastName" class="mb-2">Nom</Label>
				<Input id="lastName" name="lastName" required value={customer?.lastName ?? ''} />
			</div>
			<div>
				<Label for="email" class="mb-2">E-mail{withoutAccount ? ' (facultatif)' : ''}</Label>
				<Input
					id="email"
					name="email"
					type="email"
					required={!withoutAccount}
					value={customer?.email ?? ''}
				/>
			</div>
			<div>
				<Label for="phone" class="mb-2">Téléphone</Label>
				<Input id="phone" name="phone" value={customer?.phone ?? ''} />
			</div>
			<div class="sm:col-span-2">
				{#if isNew}
					<Checkbox name="withoutAccount" bind:checked={withoutAccount}>
						Client sans compte web (client du comptoir, sans connexion à la boutique)
					</Checkbox>
				{:else if withoutAccount}
					<input type="hidden" name="withoutAccount" value="on" />
					<p class="text-sm text-gray-500">
						Client sans compte web : il ne se connecte pas à la boutique.
					</p>
				{/if}
			</div>
		</div>
	</Card>

	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Compte</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="type" class="mb-2">Type de compte</Label>
				<Select id="type" name="type" placeholder="" items={typeOptions} bind:value={type} />
			</div>
			<div>
				<Label for="status" class="mb-2">Statut</Label>
				<Select
					id="status"
					name="status"
					placeholder=""
					items={statusOptions}
					value={customer?.status ?? 'validated'}
				/>
			</div>
		</div>

		{#if isCompany}
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="companyName" class="mb-2">Raison sociale</Label>
					<Input id="companyName" name="companyName" value={customer?.companyName ?? ''} />
				</div>
				<div>
					<Label for="siret" class="mb-2">SIRET</Label>
					<Input id="siret" name="siret" value={customer?.siret ?? ''} />
				</div>
				<div>
					<Label for="vatNumber" class="mb-2">N° TVA</Label>
					<Input id="vatNumber" name="vatNumber" value={customer?.vatNumber ?? ''} />
				</div>
			</div>
		{/if}
	</Card>

	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Divers</h2>
		<div class="space-y-4">
			<div>
				<Label for="privateNote" class="mb-2">Note privée</Label>
				<Textarea
					class="w-full"
					id="privateNote"
					name="privateNote"
					rows={3}
					value={customer?.privateNote ?? ''}
				/>
			</div>
			<Checkbox name="newsletterSubscribed" checked={customer?.newsletterSubscribed ?? false}>
				Abonné à la newsletter
			</Checkbox>
		</div>
	</Card>

	<div class="flex justify-end gap-3">
		<Button color="alternative" href="/admin/customers">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>

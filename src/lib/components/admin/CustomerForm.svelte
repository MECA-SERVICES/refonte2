<script lang="ts">
	import { enhance } from '$app/forms';
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
</script>

<form method="POST" use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<Card class="max-w-3xl p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Identité</h2>
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
				<Label for="email" class="mb-2">Email</Label>
				<Input id="email" name="email" type="email" required value={customer?.email ?? ''} />
			</div>
			<div>
				<Label for="phone" class="mb-2">Téléphone</Label>
				<Input id="phone" name="phone" value={customer?.phone ?? ''} />
			</div>
		</div>
	</Card>

	<Card class="max-w-3xl p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Compte</h2>
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

	<Card class="max-w-3xl p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Divers</h2>
		<div class="space-y-4">
			<div>
				<Label for="privateNote" class="mb-2">Note privée</Label>
				<Textarea
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

	<div class="flex max-w-3xl justify-end gap-3">
		<Button color="alternative" href="/admin/customers">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>

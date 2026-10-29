<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Alert, Button, Card, Input, Label, Textarea, Toggle } from 'flowbite-svelte';
	import type { Supplier } from '$lib/server/db/catalog.schema';

	/**
	 * Fiche fournisseur (CDC 11, § 5.1) : raison sociale, coordonnées, adresse,
	 * SIRET et notes internes. Un fournisseur archivé n'est plus proposé au
	 * rattachement d'un produit (R4).
	 */

	let {
		supplier,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		supplier?: Partial<Supplier>;
		message?: string;
		submitLabel?: string;
		action?: string;
	} = $props();
</script>

<form method="POST" {action} use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Identité</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="name" class="mb-2">Raison sociale</Label>
				<Input id="name" name="name" required value={supplier?.name ?? ''} />
			</div>
			<div>
				<Label for="code" class="mb-2">Code fournisseur (facultatif)</Label>
				<Input id="code" name="code" value={supplier?.code ?? ''} placeholder="ex. SU2111-00019" />
			</div>
			<div>
				<Label for="siret" class="mb-2">SIRET</Label>
				<Input id="siret" name="siret" value={supplier?.siret ?? ''} inputmode="numeric" />
			</div>
			<div>
				<Label for="vatNumber" class="mb-2">N° de TVA intracommunautaire</Label>
				<Input id="vatNumber" name="vatNumber" value={supplier?.vatNumber ?? ''} />
			</div>
		</div>
	</Card>

	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Coordonnées</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="email" class="mb-2">E-mail</Label>
				<Input id="email" name="email" type="email" value={supplier?.email ?? ''} />
			</div>
			<div>
				<Label for="phone" class="mb-2">Téléphone</Label>
				<Input id="phone" name="phone" value={supplier?.phone ?? ''} />
			</div>
			<div class="sm:col-span-2">
				<Label for="line1" class="mb-2">Adresse</Label>
				<Input id="line1" name="line1" value={supplier?.line1 ?? ''} />
			</div>
			<div class="sm:col-span-2">
				<Label for="line2" class="mb-2">Complément d'adresse</Label>
				<Input id="line2" name="line2" value={supplier?.line2 ?? ''} />
			</div>
			<div>
				<Label for="postalCode" class="mb-2">Code postal</Label>
				<Input id="postalCode" name="postalCode" value={supplier?.postalCode ?? ''} />
			</div>
			<div>
				<Label for="city" class="mb-2">Ville</Label>
				<Input id="city" name="city" value={supplier?.city ?? ''} />
			</div>
			<div>
				<Label for="country" class="mb-2">Pays (code à 2 lettres)</Label>
				<Input id="country" name="country" value={supplier?.country ?? 'FR'} maxlength={2} />
			</div>
		</div>
	</Card>

	<Card class="max-w-none p-6">
		<Label for="notes" class="mb-2">Notes internes</Label>
		<Textarea
			id="notes"
			name="notes"
			rows={3}
			value={supplier?.notes ?? ''}
			placeholder="Conditions, franco, interlocuteur…"
		/>
		<Toggle name="isActive" checked={supplier?.isActive ?? true} class="mt-4">
			Actif : proposé au rattachement des produits et des réceptions
		</Toggle>
	</Card>

	<div class="flex justify-end">
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>

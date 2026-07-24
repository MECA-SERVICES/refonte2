<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Label, Input, Toggle, Button, Alert } from 'flowbite-svelte';
	import type { TaxRule } from '$lib/server/db/catalog.schema';

	let {
		taxRule,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		taxRule?: Partial<TaxRule>;
		message?: string;
		submitLabel?: string;
		action?: string;
	} = $props();
</script>

<form method="POST" {action} use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<Card class="max-w-xl p-6">
		<div class="space-y-4">
			<div>
				<Label for="name" class="mb-2">Libellé</Label>
				<Input
					id="name"
					name="name"
					required
					value={taxRule?.name ?? ''}
					placeholder="Taux normal 20 %"
				/>
			</div>
			<div>
				<Label for="rate" class="mb-2">Taux (%)</Label>
				<Input
					id="rate"
					name="rate"
					type="number"
					step="0.001"
					required
					value={taxRule?.rate ?? ''}
				/>
			</div>
			<Toggle name="isActive" checked={taxRule?.isActive ?? true}>Taux actif</Toggle>
			<Toggle name="isDefault" checked={taxRule?.isDefault ?? false}>
				Taux par défaut (appliqué aux nouveaux produits)
			</Toggle>
		</div>
	</Card>

	<div class="flex max-w-xl justify-end gap-3">
		<Button color="alternative" href="/admin/taxes">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>

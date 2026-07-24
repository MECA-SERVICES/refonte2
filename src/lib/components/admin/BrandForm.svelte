<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Label, Input, Textarea, Toggle, Button, Alert } from 'flowbite-svelte';
	import type { Brand } from '$lib/server/db/catalog.schema';

	let {
		brand,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		brand?: Partial<Brand>;
		message?: string;
		submitLabel?: string;
		action?: string;
	} = $props();
</script>

<form method="POST" {action} use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<Card class="max-w-2xl p-6">
		<div class="space-y-4">
			<div>
				<Label for="name" class="mb-2">Nom</Label>
				<Input id="name" name="name" required value={brand?.name ?? ''} />
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Le slug (URL) sera généré automatiquement à partir du nom si laissé vide.
				</p>
			</div>
			<div>
				<Label for="slug" class="mb-2">Slug (optionnel)</Label>
				<Input id="slug" name="slug" value={brand?.slug ?? ''} placeholder="ex : bosch" />
			</div>
			<div>
				<Label for="logoUrl" class="mb-2">URL du logo</Label>
				<Input id="logoUrl" name="logoUrl" value={brand?.logoUrl ?? ''} />
			</div>
			<div>
				<Label for="description" class="mb-2">Description</Label>
				<Textarea id="description" name="description" rows={3} value={brand?.description ?? ''} />
			</div>
			<Toggle name="isActive" checked={brand?.isActive ?? true}>Marque active</Toggle>
		</div>
	</Card>

	<div class="flex max-w-2xl justify-end gap-3">
		<Button color="alternative" href="/admin/brands">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>

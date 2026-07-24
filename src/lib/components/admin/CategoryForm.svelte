<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Label, Input, Textarea, Select, Toggle, Button, Alert } from 'flowbite-svelte';
	import type { Category } from '$lib/server/db/catalog.schema';

	let {
		category,
		parentOptions,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		category?: Partial<Category>;
		parentOptions: { value: string; name: string }[];
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
				<Input id="name" name="name" required value={category?.name ?? ''} />
			</div>
			<div>
				<Label for="slug" class="mb-2">Slug (optionnel)</Label>
				<Input id="slug" name="slug" value={category?.slug ?? ''} />
			</div>
			<div>
				<Label for="parentId" class="mb-2">Catégorie parente</Label>
				<Select
					id="parentId"
					name="parentId"
					placeholder=""
					value={category?.parentId ? String(category.parentId) : ''}
					items={[{ value: '', name: 'Aucune (racine)' }, ...parentOptions]}
				/>
			</div>
			<div>
				<Label for="position" class="mb-2">Position</Label>
				<Input
					id="position"
					name="position"
					type="number"
					value={String(category?.position ?? 0)}
				/>
			</div>
			<div>
				<Label for="description" class="mb-2">Description</Label>
				<Textarea
					id="description"
					name="description"
					rows={3}
					value={category?.description ?? ''}
				/>
			</div>
			<Toggle name="isActive" checked={category?.isActive ?? true}>Catégorie active</Toggle>
		</div>
	</Card>

	<div class="flex max-w-2xl justify-end gap-3">
		<Button color="alternative" href="/admin/categories">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>

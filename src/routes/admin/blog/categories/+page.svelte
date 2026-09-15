<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Badge, Button, Card, Input, Label, Textarea, Toggle } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Category = (typeof data.rows)[number];

	/** `null` ferme le formulaire ; un objet vide ouvre une création. */
	let editing = $state<Category | Record<string, never> | null>(null);

	const isNew = $derived(editing !== null && !('id' in editing));
	const current = $derived(editing as Category | null);
</script>

<svelte:head><title>Catégories du blog · Administration</title></svelte:head>

<PageHeader
	title="Catégories du blog"
	subtitle="{data.rows.length} catégorie{data.rows.length > 1 ? 's' : ''}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Blog', href: '/admin/blog' },
		{ label: 'Catégories' }
	]}
>
	{#snippet actions()}
		{#if editing === null}
			<Button onclick={() => (editing = {})}>
				<PlusOutline class="me-2 h-4 w-4" /> Nouvelle catégorie
			</Button>
		{/if}
	{/snippet}
</PageHeader>

{#if form?.message}
	<Alert color="red" class="mb-4">{form.message}</Alert>
{/if}

{#if editing !== null}
	<Card class="mb-6 max-w-none p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">
			{isNew ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
		</h2>

		<form
			method="POST"
			action="?/save"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') editing = null;
					await update();
				}}
			class="space-y-4"
		>
			{#if !isNew && current}
				<input type="hidden" name="id" value={current.id} />
			{/if}

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="name" class="mb-2">Libellé</Label>
					<Input id="name" name="name" required value={current?.name ?? ''} />
				</div>
				<div>
					<Label for="slug" class="mb-2">Adresse</Label>
					<Input id="slug" name="slug" value={current?.slug ?? ''} />
				</div>
			</div>

			<div>
				<Label for="description" class="mb-2">Description</Label>
				<Textarea id="description" name="description" rows={2} value={current?.description ?? ''} />
			</div>

			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<Label for="color" class="mb-2">Couleur</Label>
					<Input id="color" name="color" value={current?.color ?? ''} placeholder="#314192" />
				</div>
				<div>
					<Label for="sortOrder" class="mb-2">Position</Label>
					<Input
						id="sortOrder"
						name="sortOrder"
						type="number"
						value={String(current?.sortOrder ?? 0)}
					/>
				</div>
				<div class="flex items-end">
					<Toggle name="isActive" checked={current?.isActive ?? true}>Visible</Toggle>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				<Button type="submit" color="primary">Enregistrer</Button>
				<Button color="alternative" onclick={() => (editing = null)}>Annuler</Button>
			</div>
		</form>
	</Card>
{/if}

{#if data.rows.length === 0}
	<Card class="max-w-none p-10 text-center">
		<p class="text-gray-600 dark:text-gray-300">
			Aucune catégorie. Créez-en une pour classer vos articles.
		</p>
	</Card>
{:else}
	<div class="space-y-2">
		{#each data.rows as row (row.id)}
			<Card class="max-w-none p-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex min-w-0 items-center gap-3">
						{#if row.color}
							<span
								class="h-4 w-4 shrink-0 rounded-full"
								style="background-color: {row.color}"
								aria-hidden="true"
							></span>
						{/if}
						<div class="min-w-0">
							<p class="font-medium text-gray-900 dark:text-white">{row.name}</p>
							<p class="text-xs text-gray-500">/blog/categorie/{row.slug}</p>
						</div>
						{#if !row.isActive}<Badge color="gray">Masquée</Badge>{/if}
					</div>

					<div class="flex shrink-0 gap-2">
						<Button size="xs" color="alternative" onclick={() => (editing = row)}>Modifier</Button>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={row.id} />
							<Button size="xs" color="red" type="submit">Supprimer</Button>
						</form>
					</div>
				</div>
			</Card>
		{/each}
	</div>
{/if}

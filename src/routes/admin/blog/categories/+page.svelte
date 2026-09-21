<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Badge,
		Button,
		Card,
		Input,
		Label,
		Select,
		Textarea,
		Toggle
	} from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { PageHeader } from '$lib/components/admin';
	import { BLOG_CATEGORY_MAX_DEPTH } from '$lib/blog';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Category = (typeof data.rows)[number];

	/** `null` ferme le formulaire ; un objet vide ouvre une création. */
	let editing = $state<Category | Record<string, never> | null>(null);

	const isNew = $derived(editing !== null && !('id' in editing));
	const current = $derived(editing as Category | null);

	/** Ids de la catégorie éditée et de sa descendance : parents interdits. */
	function forbiddenIds(rows: Category[], rootId: number): number[] {
		const ids = [rootId];

		for (let i = 0; i < ids.length; i++) {
			for (const c of rows) {
				if (c.parentId === ids[i] && !ids.includes(c.id)) ids.push(c.id);
			}
		}
		return ids;
	}

	/*
	 * Parents proposés : tout sauf la catégorie éditée, sa descendance, et les
	 * catégories déjà au dernier niveau — qui ne peuvent plus accueillir d'enfant.
	 * Le serveur revalide : cette liste n'est qu'un confort de saisie.
	 */
	const parentOptions = $derived.by(() => {
		const excluded = current?.id ? forbiddenIds(data.rows, current.id) : [];

		return [
			{ value: '', name: '— Catégorie principale —' },
			...data.rows
				.filter((c) => !excluded.includes(c.id) && c.depth < BLOG_CATEGORY_MAX_DEPTH)
				.map((c) => ({
					value: String(c.id),
					// Insécables : un `<option>` écrase les espaces ordinaires.
					name: `${'  '.repeat(c.depth - 1)}${c.depth > 1 ? '└ ' : ''}${c.name}`
				}))
		];
	});
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
				<Label for="parentId" class="mb-2">Catégorie parente</Label>
				<Select
					id="parentId"
					name="parentId"
					items={parentOptions}
					value={current?.parentId ? String(current.parentId) : ''}
				/>
				<p class="mt-1 text-xs text-gray-500">
					Arborescence limitée à {BLOG_CATEGORY_MAX_DEPTH} niveaux. Ouvrir une catégorie affiche aussi
					les articles de ses sous-catégories.
				</p>
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
			<!-- Décalage proportionnel au niveau : l'arborescence se lit d'un coup d'œil. -->
			<Card class="max-w-none p-4" style="margin-left: {(row.depth - 1) * 1.5}rem">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex min-w-0 items-center gap-3">
						{#if row.depth > 1}
							<span class="shrink-0 text-gray-400" aria-hidden="true">└</span>
						{/if}
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

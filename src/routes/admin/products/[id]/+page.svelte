<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card, Input, Label, Select, Textarea, Toggle } from 'flowbite-svelte';
	import { TrashBinOutline, PlusOutline } from 'flowbite-svelte-icons';
	import { PageHeader, ProductForm, ActiveBadge, ConfirmDialog } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const p = $derived(data.product);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);

	const mediaTypes = [
		{ value: 'image', name: 'Image' },
		{ value: 'video', name: 'Vidéo' },
		{ value: 'pdf', name: 'PDF (vue éclatée)' }
	];

	function attrText(attrs: Record<string, string> | null): string {
		if (!attrs) return '—';
		return Object.entries(attrs)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
	}
</script>

<svelte:head><title>{p.name} · Produits</title></svelte:head>

<PageHeader
	title={p.name}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Produits', href: '/admin/products' },
		{ label: p.name }
	]}
>
	{#snippet actions()}
		<ActiveBadge active={p.isActive} />
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<!-- Édition des champs principaux -->
<ProductForm
	product={p}
	brandOptions={data.brandOptions}
	categoryOptions={data.categoryOptions}
	action="?/update"
	message={form?.message}
	submitLabel="Enregistrer"
/>

<!-- Variantes -->
<Card class="mt-6 max-w-4xl p-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
		Variantes ({p.variants.length})
	</h2>

	{#if p.variants.length > 0}
		<div class="mb-4 space-y-2">
			{#each p.variants as v (v.id)}
				<div
					class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
				>
					<div>
						<span class="font-medium text-gray-900 dark:text-white">{v.name}</span>
						{#if v.isDefault}
							<span class="ms-2 text-xs text-cyan-600">(par défaut)</span>
						{/if}
						<span class="block text-sm text-gray-500 dark:text-gray-400">
							{attrText(v.attributes)} · Stock : {v.stock} · Impact prix : {v.priceImpact} €
						</span>
					</div>
					<form method="POST" action="?/deleteVariant" use:enhance>
						<input type="hidden" name="variantId" value={v.id} />
						<Button type="submit" size="xs" color="red">Supprimer</Button>
					</form>
				</div>
			{/each}
		</div>
	{:else}
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Aucune variante.</p>
	{/if}

	<form method="POST" action="?/addVariant" use:enhance class="grid gap-3 sm:grid-cols-2">
		{#if form?.variantError}
			<p class="text-sm text-red-600 sm:col-span-2">{form.variantError}</p>
		{/if}
		<div>
			<Label for="v-name" class="mb-2">Nom</Label>
			<Input id="v-name" name="name" required placeholder="ex : Taille 39" />
		</div>
		<div>
			<Label for="v-ref" class="mb-2">Référence</Label>
			<Input id="v-ref" name="reference" />
		</div>
		<div class="sm:col-span-2">
			<Label for="v-attrs" class="mb-2">Attributs (une paire clé=valeur par ligne)</Label>
			<Textarea id="v-attrs" name="attributes" rows={2} placeholder="Pointure=39" />
		</div>
		<div>
			<Label for="v-price" class="mb-2">Impact prix (€)</Label>
			<Input id="v-price" name="priceImpact" type="number" step="0.01" value="0" />
		</div>
		<div>
			<Label for="v-stock" class="mb-2">Stock</Label>
			<Input id="v-stock" name="stock" type="number" value="0" />
		</div>
		<div class="flex items-center gap-3 sm:col-span-2">
			<Toggle name="isDefault">Variante par défaut</Toggle>
			<Button type="submit" size="sm">
				<PlusOutline class="me-1 h-4 w-4" /> Ajouter la variante
			</Button>
		</div>
	</form>
</Card>

<!-- Médias -->
<Card class="mt-6 max-w-4xl p-6">
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
		Médias ({p.media.length})
	</h2>

	{#if p.media.length > 0}
		<div class="mb-4 grid gap-3 sm:grid-cols-2">
			{#each p.media as m (m.id)}
				<div
					class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
				>
					<div class="min-w-0">
						<span class="text-xs text-gray-400 uppercase">{m.type}</span>
						<span class="block truncate text-sm text-gray-900 dark:text-white">{m.url}</span>
					</div>
					<form method="POST" action="?/deleteMedia" use:enhance>
						<input type="hidden" name="mediaId" value={m.id} />
						<Button type="submit" size="xs" color="red">Supprimer</Button>
					</form>
				</div>
			{/each}
		</div>
	{:else}
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Aucun média.</p>
	{/if}

	<form method="POST" action="?/addMedia" use:enhance class="grid gap-3 sm:grid-cols-2">
		{#if form?.mediaError}
			<p class="text-sm text-red-600 sm:col-span-2">{form.mediaError}</p>
		{/if}
		<div>
			<Label for="m-type" class="mb-2">Type</Label>
			<Select id="m-type" name="type" placeholder="" items={mediaTypes} value="image" />
		</div>
		<div>
			<Label for="m-pos" class="mb-2">Position</Label>
			<Input id="m-pos" name="position" type="number" value="0" />
		</div>
		<div class="sm:col-span-2">
			<Label for="m-url" class="mb-2">URL</Label>
			<Input id="m-url" name="url" required placeholder="https://…" />
		</div>
		<div class="sm:col-span-2">
			<Button type="submit" size="sm">
				<PlusOutline class="me-1 h-4 w-4" /> Ajouter le média
			</Button>
		</div>
	</form>
</Card>

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le produit"
	message="Le produit, ses variantes et ses médias seront définitivement supprimés."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>

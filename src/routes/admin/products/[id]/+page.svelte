<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card, Input, Label, Select, Textarea, Toggle } from 'flowbite-svelte';
	import { TrashBinOutline, PlusOutline } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		ProductForm,
		ActiveBadge,
		ConfirmDialog,
		ProductMediaGrid
	} from '$lib/components/admin';
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

	const movementTypeOptions = [
		{ value: 'in', name: 'Entrée (réappro)' },
		{ value: 'out', name: 'Sortie' },
		{ value: 'adjustment', name: 'Ajustement inventaire' },
		{ value: 'return', name: 'Retour client' }
	];

	const movementLabels: Record<string, string> = {
		in: 'Entrée',
		out: 'Sortie',
		adjustment: 'Ajustement',
		order: 'Commande',
		return: 'Retour'
	};

	function attrText(attrs: Record<string, string> | null): string {
		if (!attrs) return '—';
		return Object.entries(attrs)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
	}

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head><title>{p.name} · Produits</title></svelte:head>

<PageHeader
	title={p.name}
	subtitle="Réf. {p.reference}"
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

<!--
	Les blocs stock / variantes / médias contiennent leurs propres <form> : ils sont
	passés en snippets pour être rendus dans les onglets sans être imbriqués dans le
	formulaire principal (l'imbrication de <form> est invalide en HTML).
-->
{#snippet stockPanel()}
	<Card class="max-w-none p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Mouvements de stock</h2>
			<span class="text-sm text-gray-500 dark:text-gray-400">
				Stock actuel : <span class="font-semibold text-gray-900 dark:text-white">{p.stock}</span>
			</span>
		</div>

		{#if form?.stockError}
			<p class="mb-3 text-sm text-red-600">{form.stockError}</p>
		{/if}

		<div class="mb-6 grid gap-3 sm:grid-cols-4">
			<div>
				<Label for="sm-type" class="mb-2">Type</Label>
				<Select
					id="sm-type"
					name="type"
					form="stock-movement-form"
					placeholder=""
					items={movementTypeOptions}
					value="in"
				/>
			</div>
			<div>
				<Label for="sm-qty" class="mb-2">Quantité</Label>
				<Input id="sm-qty" name="quantity" form="stock-movement-form" type="number" value="1" />
			</div>
			<div class="sm:col-span-2">
				<Label for="sm-note" class="mb-2">Note</Label>
				<Input
					id="sm-note"
					name="note"
					form="stock-movement-form"
					placeholder="ex : réception commande fournisseur"
				/>
			</div>
			<div class="sm:col-span-4">
				<Button type="submit" size="sm" form="stock-movement-form">
					<PlusOutline class="me-1 h-4 w-4" /> Enregistrer le mouvement
				</Button>
			</div>
		</div>

		{#if p.movements.length > 0}
			<div class="space-y-1">
				{#each p.movements as mv (mv.id)}
					<div
						class="flex items-center justify-between border-b border-gray-100 py-2 text-sm dark:border-gray-800"
					>
						<div>
							<span class="font-medium text-gray-900 dark:text-white">
								{movementLabels[mv.type] ?? mv.type}
							</span>
							<span class={mv.quantity >= 0 ? 'ms-2 text-green-600' : 'ms-2 text-red-600'}>
								{mv.quantity >= 0 ? '+' : ''}{mv.quantity}
							</span>
							{#if mv.note}
								<span class="ms-2 text-gray-500 dark:text-gray-400">— {mv.note}</span>
							{/if}
						</div>
						<span class="text-gray-400">{dateFmt.format(new Date(mv.createdAt))}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-gray-500 dark:text-gray-400">Aucun mouvement enregistré.</p>
		{/if}
	</Card>
{/snippet}

{#snippet variantsPanel()}
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
			Déclinaisons ({p.variants.length})
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
			<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Aucune déclinaison.</p>
		{/if}

		{#if form?.variantError}
			<p class="mb-3 text-sm text-red-600">{form.variantError}</p>
		{/if}

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<Label for="v-name" class="mb-2">Nom</Label>
				<Input id="v-name" name="name" form="variant-form" required placeholder="ex : Taille 39" />
			</div>
			<div>
				<Label for="v-ref" class="mb-2">Référence</Label>
				<Input id="v-ref" name="reference" form="variant-form" />
			</div>
			<div class="sm:col-span-2">
				<Label for="v-attrs" class="mb-2">Attributs (une paire clé=valeur par ligne)</Label>
				<Textarea
					id="v-attrs"
					name="attributes"
					form="variant-form"
					rows={2}
					placeholder="Pointure=39"
				/>
			</div>
			<div>
				<Label for="v-price" class="mb-2">Impact prix (€)</Label>
				<Input
					id="v-price"
					name="priceImpact"
					form="variant-form"
					type="number"
					step="0.01"
					value="0"
				/>
			</div>
			<div>
				<Label for="v-stock" class="mb-2">Stock</Label>
				<Input id="v-stock" name="stock" form="variant-form" type="number" value="0" />
			</div>
			<div class="flex items-center gap-3 sm:col-span-2">
				<Toggle name="isDefault" form="variant-form">Déclinaison par défaut</Toggle>
				<Button type="submit" size="sm" form="variant-form">
					<PlusOutline class="me-1 h-4 w-4" /> Ajouter la déclinaison
				</Button>
			</div>
		</div>
	</Card>
{/snippet}

{#snippet mediaPanel()}
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
			Images ({p.media.length})
		</h2>

		<div class="mb-4">
			<ProductMediaGrid media={p.media} productName={p.name} />
		</div>

		{#if form?.mediaError}
			<p class="mb-3 text-sm text-red-600">{form.mediaError}</p>
		{/if}

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<Label for="m-type" class="mb-2">Type</Label>
				<Select
					id="m-type"
					name="type"
					form="media-form"
					placeholder=""
					items={mediaTypes}
					value="image"
				/>
			</div>
			<div>
				<Label for="m-pos" class="mb-2">Position</Label>
				<Input id="m-pos" name="position" form="media-form" type="number" value="0" />
			</div>
			<div class="sm:col-span-2">
				<Label for="m-url" class="mb-2">URL</Label>
				<Input id="m-url" name="url" form="media-form" required placeholder="https://…" />
			</div>
			<div class="sm:col-span-2">
				<Button type="submit" size="sm" form="media-form">
					<PlusOutline class="me-1 h-4 w-4" /> Ajouter le média
				</Button>
			</div>
		</div>
	</Card>
{/snippet}

<ProductForm
	product={p}
	brandOptions={data.brandOptions}
	categoryOptions={data.categoryOptions}
	taxOptions={data.taxOptions}
	action="?/update"
	message={form?.message}
	submitLabel="Enregistrer"
	productId={p.id}
	{stockPanel}
	{variantsPanel}
	{mediaPanel}
/>

<!--
	Formulaires secondaires déclarés hors du formulaire principal ; les champs
	ci-dessus s'y rattachent via l'attribut form="…".
-->
<form
	id="stock-movement-form"
	method="POST"
	action="?/stockMovement"
	use:enhance
	class="hidden"
></form>
<form id="variant-form" method="POST" action="?/addVariant" use:enhance class="hidden"></form>
<form id="media-form" method="POST" action="?/addMedia" use:enhance class="hidden"></form>

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le produit"
	message="Le produit, ses variantes et ses médias seront définitivement supprimés."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>

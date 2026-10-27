<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Alert, Button, Card, Checkbox, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import StateBadge from '$lib/components/admin/StateBadge.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Les champs gardent la valeur enregistrée, sans revenir à celle du chargement. */
	const keepValues: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });

	const tones = [
		{ value: 'blue', name: 'Bleu' },
		{ value: 'red', name: 'Rouge' },
		{ value: 'dark', name: 'Sombre' },
		{ value: 'photo', name: 'Photo plein cadre' }
	];

	const categoryItems = $derived(
		data.categoryOptions.map((c) => ({
			value: String(c.id),
			name: c.parentName ? `${c.parentName} › ${c.name}` : c.name
		}))
	);

	type Tile = (typeof data.tiles)[number];
	/** Tuile vide, pour le formulaire d'ajout. */
	const blankTile = $derived({
		id: 0,
		eyebrow: '',
		title: '',
		imageUrl: '',
		linkUrl: '',
		buttonLabel: 'Je découvre',
		tone: 'blue',
		badge: '',
		position: (data.tiles.length + 1) * 10,
		isActive: true
	});
</script>

<svelte:head><title>Page d'accueil · Apparence</title></svelte:head>

<PageHeader
	title="Page d'accueil"
	subtitle="Tuiles promotionnelles, catégories et produits mis en avant"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: "Page d'accueil" }]}
>
	{#snippet actions()}
		<Button href="/" target="_blank" rel="noopener" size="sm" color="alternative">
			Voir l'accueil
		</Button>
	{/snippet}
</PageHeader>

{#if form && 'message' in form && form.message}
	<Alert color="red" class="mb-4">{form.message}</Alert>
{/if}

<p class="mb-6 text-sm text-gray-500">
	Les images sont des adresses (ex. <code>/promo/tondeuse.jpg</code> ou une URL complète). Un bloc sans
	réglage laisse place au bloc automatique d'origine.
</p>

<!-- ================= Tuiles promotionnelles (10.1) ================= -->
{#snippet tileForm(tile: Tile | typeof blankTile, isNew: boolean)}
	<form
		method="POST"
		action="?/saveTile"
		use:enhance={isNew ? undefined : keepValues}
		data-success={isNew ? 'Tuile ajoutée.' : 'Tuile enregistrée.'}
		class="grid gap-3 sm:grid-cols-2"
	>
		{#if !isNew}<input type="hidden" name="id" value={tile.id} />{/if}
		<div>
			<Label class="mb-1 text-xs">Surtitre</Label>
			<Input
				aria-label="Surtitre"
				name="eyebrow"
				size="sm"
				value={tile.eyebrow ?? ''}
				placeholder="PROMOTION"
			/>
		</div>
		<div>
			<Label class="mb-1 text-xs">Titre *</Label>
			<Input
				aria-label="Titre"
				name="title"
				size="sm"
				value={tile.title}
				required
				placeholder="Sélection de batteries"
			/>
		</div>
		<div>
			<Label class="mb-1 text-xs">Image</Label>
			<Input
				aria-label="Image"
				name="imageUrl"
				size="sm"
				value={tile.imageUrl ?? ''}
				placeholder="/promo/…jpg"
			/>
		</div>
		<div>
			<Label class="mb-1 text-xs">Lien *</Label>
			<Input
				aria-label="Lien"
				name="linkUrl"
				size="sm"
				value={tile.linkUrl}
				required
				placeholder="/categorie/batteries"
			/>
		</div>
		<div>
			<Label class="mb-1 text-xs">Bouton</Label>
			<Input aria-label="Bouton" name="buttonLabel" size="sm" value={tile.buttonLabel} />
		</div>
		<div>
			<Label class="mb-1 text-xs">Pastille</Label>
			<Input
				aria-label="Pastille"
				name="badge"
				size="sm"
				value={tile.badge ?? ''}
				placeholder="PROMO (facultatif)"
			/>
		</div>
		<div>
			<Label class="mb-1 text-xs">Couleur</Label>
			<Select
				aria-label="Couleur"
				name="tone"
				size="sm"
				items={tones}
				value={tile.tone}
				placeholder=""
			/>
		</div>
		<div>
			<Label class="mb-1 text-xs">Ordre</Label>
			<Input aria-label="Ordre" name="position" type="number" size="sm" value={tile.position} />
		</div>
		<div class="flex items-center justify-between gap-2 sm:col-span-2">
			<Checkbox name="isActive" checked={tile.isActive}>Affichée</Checkbox>
			<Button type="submit" size="xs">{isNew ? 'Ajouter la tuile' : 'Enregistrer'}</Button>
		</div>
	</form>
{/snippet}

<Card class="mb-6 max-w-none p-6">
	<h2 class="mb-1 text-lg font-semibold text-gray-900">Tuiles promotionnelles</h2>
	<p class="mb-4 text-xs text-gray-500">
		À la manière de Kramp, à la place de « Nos marques » : les 4 premières tuiles affichées
		apparaissent sur l'accueil.
	</p>

	<div class="space-y-4">
		{#each data.tiles as tile (tile.id)}
			<div class="rounded-lg border border-gray-200 p-4">
				<div class="mb-3 flex items-center justify-between gap-2">
					<p class="font-medium text-gray-900">
						{tile.title}
						{#if !tile.isActive}<StateBadge color="gray" class="ms-2" label="Masquée" />{/if}
					</p>
					<form method="POST" action="?/deleteTile" use:enhance data-success="Tuile supprimée.">
						<input type="hidden" name="id" value={tile.id} />
						<Button type="submit" size="xs" color="alternative">Supprimer</Button>
					</form>
				</div>
				{@render tileForm(tile, false)}
			</div>
		{/each}

		<div class="rounded-lg border border-dashed border-gray-300 p-4">
			<p class="mb-3 font-medium text-gray-900">Nouvelle tuile</p>
			{@render tileForm(blankTile, true)}
		</div>
	</div>
</Card>

<!-- ================= Catégories mises en avant (10.3) ================= -->
<Card class="mb-6 max-w-none p-6">
	<h2 class="mb-1 text-lg font-semibold text-gray-900">Catégories</h2>
	<p class="mb-4 text-xs text-gray-500">
		Bloc « Par catégories » de l'accueil, chacune avec son visuel. Sans sélection, les rayons du
		menu s'affichent.
	</p>

	{#if data.categories.length > 0}
		<ul class="mb-4 space-y-2">
			{#each data.categories as c (c.categoryId)}
				<li class="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-3">
					<form
						method="POST"
						action="?/saveCategory"
						use:enhance={keepValues}
						data-success="Catégorie enregistrée."
						class="flex flex-1 flex-wrap items-end gap-2"
					>
						<input type="hidden" name="categoryId" value={c.categoryId} />
						<p class="min-w-48 flex-1 text-sm font-medium text-gray-900">
							{c.parentName ? `${c.parentName} › ` : ''}{c.name}
						</p>
						<div class="w-72">
							<Label class="mb-1 text-xs">Image</Label>
							<Input aria-label="Image" name="imageUrl" size="sm" value={c.imageUrl ?? ''} />
						</div>
						<div class="w-20">
							<Label class="mb-1 text-xs">Ordre</Label>
							<Input
								aria-label="Ordre"
								name="position"
								type="number"
								size="sm"
								value={c.position}
							/>
						</div>
						<Button type="submit" size="xs" color="alternative">Enregistrer</Button>
					</form>
					<form
						method="POST"
						action="?/removeCategory"
						use:enhance
						data-success="Catégorie retirée."
					>
						<input type="hidden" name="categoryId" value={c.categoryId} />
						<Button type="submit" size="xs" color="alternative">Retirer</Button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<form
		method="POST"
		action="?/saveCategory"
		use:enhance
		data-success="Catégorie ajoutée."
		class="flex flex-wrap items-end gap-2"
	>
		<div class="min-w-64 flex-1">
			<Label class="mb-1 text-xs">Ajouter une catégorie</Label>
			<Select
				aria-label="Ajouter une catégorie"
				name="categoryId"
				size="sm"
				items={categoryItems}
				placeholder="Choisir…"
				required
			/>
		</div>
		<div class="w-72">
			<Label class="mb-1 text-xs">Image</Label>
			<Input aria-label="Image" name="imageUrl" size="sm" placeholder="/img/categories/…jpg" />
		</div>
		<div class="w-20">
			<Label class="mb-1 text-xs">Ordre</Label>
			<Input
				aria-label="Ordre"
				name="position"
				type="number"
				size="sm"
				value={(data.categories.length + 1) * 10}
			/>
		</div>
		<Button type="submit" size="xs">Ajouter</Button>
	</form>
</Card>

<!-- ================= Produits phares (10.4) ================= -->
<Card class="max-w-none p-6">
	<h2 class="mb-1 text-lg font-semibold text-gray-900">Produits phares</h2>
	<p class="mb-4 text-xs text-gray-500">
		Sélection affichée dans « Nos produits phares ». Sans sélection, l'accueil montre le stock
		atelier et les derniers arrivages.
	</p>

	<form
		method="POST"
		action="?/saveFeaturedImage"
		use:enhance={keepValues}
		data-success="Visuel enregistré."
		class="mb-5 flex flex-wrap items-end gap-2"
	>
		<div class="min-w-64 flex-1">
			<Label class="mb-1 text-xs">Image à côté de la sélection</Label>
			<Input
				aria-label="Image à côté de la sélection"
				name="imageUrl"
				size="sm"
				value={data.featuredImageUrl}
				placeholder="/promo/…jpg"
			/>
		</div>
		<div class="min-w-64 flex-1">
			<Label class="mb-1 text-xs">Lien de l'image (facultatif)</Label>
			<Input
				aria-label="Lien de l'image (facultatif)"
				name="imageLink"
				size="sm"
				value={data.featuredImageLink}
				placeholder="/marque/…"
			/>
		</div>
		<Button type="submit" size="xs" color="alternative">Enregistrer</Button>
	</form>

	{#if data.products.length > 0}
		<ul class="mb-4 divide-y divide-gray-100">
			{#each data.products as p (p.productId)}
				<li class="flex flex-wrap items-center gap-3 py-2">
					<a
						href="/admin/products/{p.productId}"
						class="min-w-0 flex-1 truncate text-sm font-medium text-primary-700 hover:underline"
					>
						{p.name}
					</a>
					<span class="text-xs text-gray-500">{p.reference}</span>
					{#if !p.isActive}<StateBadge color="gray" label="Inactif, non affiché" />{/if}
					<form
						method="POST"
						action="?/productPosition"
						use:enhance={keepValues}
						data-success="Ordre enregistré."
						class="flex items-center gap-1"
					>
						<input type="hidden" name="productId" value={p.productId} />
						<Input
							name="position"
							type="number"
							size="sm"
							value={p.position}
							class="w-20"
							aria-label="Ordre de {p.name}"
						/>
						<Button type="submit" size="xs" color="alternative">OK</Button>
					</form>
					<form method="POST" action="?/removeProduct" use:enhance data-success="Produit retiré.">
						<input type="hidden" name="productId" value={p.productId} />
						<Button type="submit" size="xs" color="alternative">Retirer</Button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="POST" action="?/addProducts" use:enhance data-success="Produits ajoutés.">
		<Label for="products" class="mb-1 text-xs"
			>Ajouter des produits (références ou identifiants)</Label
		>
		<Textarea
			id="products"
			name="products"
			rows={3}
			class="w-full"
			placeholder="Une référence par ligne, ou séparées par des virgules"
		/>
		<div class="mt-2 flex justify-end">
			<Button type="submit" size="xs">Ajouter</Button>
		</div>
	</form>
</Card>

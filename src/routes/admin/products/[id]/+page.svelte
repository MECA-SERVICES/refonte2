<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input, Label, Select, Textarea, Toggle } from 'flowbite-svelte';
	import {
		TrashBinOutline,
		PlusOutline,
		ArrowUpRightFromSquareOutline,
		PrinterOutline
	} from 'flowbite-svelte-icons';
	import {
		PageHeader,
		ProductForm,
		ActiveBadge,
		ConditionBadge,
		ConfirmDialog,
		LocationPicker,
		ProductMediaGrid,
		StateBadge
	} from '$lib/components/admin';
	import { DOLIBARR_STOCK_COLORS } from '$lib/admin-colors';
	import { conditionLabel, STOCK_CONDITIONS } from '$lib/stock-locations';
	import { isValidEan13, printableEan13 } from '$lib/ean13';
	import { shopProductPath } from '$lib/shop';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const p = $derived(data.product);
	let confirmOpen = $state(false);
	let labelCopies = $state(1);
	let deleteForm = $state<HTMLFormElement | null>(null);

	const mediaTypes = [
		{ value: 'image', name: 'Image' },
		{ value: 'video', name: 'Vidéo' },
		{ value: 'pdf', name: 'PDF (vue éclatée)' }
	];

	const movementTypeOptions = [
		{ value: 'in', name: 'Entrée (réappro)' },
		{ value: 'out', name: 'Sortie' },
		{ value: 'adjustment', name: 'Ajustement inventaire (+ ou −)' },
		{ value: 'return', name: 'Retour client' }
	];

	const movementLabels: Record<string, string> = {
		in: 'Entrée',
		out: 'Sortie',
		adjustment: 'Ajustement',
		order: 'Sortie commande',
		return: 'Retour',
		repair: 'Sortie réparation',
		transfer: 'Déplacement',
		sale: 'Vente comptoir'
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
		<!--
			Nouvel onglet : la fiche peut porter des modifications non
			enregistrées, quitter la page les perdrait.

			L'adresse vient du slug **enregistré** : le champ « URL simplifiée »
			peut avoir été modifié sans être soumis, et le lien mènerait alors à
			une page introuvable.
		-->
		<Button
			color="alternative"
			href={shopProductPath({ id: p.id, slug: p.slug })}
			target="_blank"
			rel="noopener"
		>
			<ArrowUpRightFromSquareOutline class="me-2 h-4 w-4" /> Voir sur la boutique
		</Button>
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
			<h2 class="text-lg font-semibold text-gray-900">Mouvements de stock</h2>
			<span class="text-sm text-gray-500">
				Stock actuel : <span class="font-semibold text-gray-900">{p.stock}</span>
			</span>
		</div>

		<!--
			Rangement : le stock du produit est la somme de ses emplacements, comme
			dans Dolibarr. Code au survol : la description de l'emplacement.
		-->
		<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h3 class="mb-2 text-sm font-semibold text-gray-900">Rangement</h3>
			{#if data.placements.length === 0}
				<p class="text-sm text-gray-500">
					Rangé dans aucun emplacement : enregistrez une entrée ci-dessous pour le ranger.
				</p>
			{:else}
				<ul class="space-y-1 text-sm">
					{#each data.placements as s (`${s.locationId}:${s.condition}`)}
						<li class="flex justify-between gap-3">
							<a href="/admin/stock-locations?id={s.locationId}" class="hover:underline">
								{#if s.code}
									<span
										title={s.description ?? s.path}
										style:background-color={DOLIBARR_STOCK_COLORS.inStock}
										class="me-1 cursor-help rounded px-1.5 py-0.5 font-mono text-xs text-gray-900"
										>{s.code}</span
									>
								{/if}
								<span class="text-primary-700">{s.path}</span>
								<ConditionBadge condition={s.condition} class="ms-1" />
							</a>
							<span class="font-semibold tabular-nums">{s.quantity}</span>
						</li>
						{#if s.serials.length}
							<li class="-mt-1 ps-2 font-mono text-xs text-gray-600">N° {s.serials.join(', ')}</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Étiquette produit, au gabarit de la « Génération étiquette » Dolibarr (jaune comme dans UTILE). -->
		<div
			class="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4"
			style:background-color={DOLIBARR_STOCK_COLORS.label}
		>
			<div>
				<Label for="label-copies" class="mb-2">Étiquettes à imprimer</Label>
				<Input
					id="label-copies"
					type="number"
					min={1}
					max={100}
					bind:value={labelCopies}
					class="w-24"
				/>
			</div>
			<Button
				color="alternative"
				href="/admin/products/labels?ids={Array(Math.min(100, Math.max(1, labelCopies || 1)))
					.fill(p.id)
					.join(',')}"
				target="_blank"
			>
				<PrinterOutline class="me-2 h-4 w-4" /> Imprimer
			</Button>
			<p class="text-xs text-gray-700">
				{data.onSaleFloor
					? 'Prix TTC imprimé : le produit est rangé au magasin.'
					: 'Sans prix : le produit n’est pas rangé au magasin.'}
			</p>
			{#if p.ean13 && !isValidEan13(p.ean13)}
				<p class="text-xs text-red-700">
					EAN-13 invalide : l'étiquette imprimera {printableEan13(p.ean13)}.
				</p>
			{/if}
		</div>

		{#if form?.stockError}
			<p class="mb-3 text-sm text-red-600">{form.stockError}</p>
		{/if}

		<div class="mb-6 grid gap-3 sm:grid-cols-4">
			<div class="sm:col-span-4">
				<Label class="mb-2">Emplacement</Label>
				<LocationPicker
					locations={data.locations}
					name="locationId"
					form="stock-movement-form"
					value={data.placements[0]?.locationId ?? null}
					label="Emplacement du mouvement"
					required
				/>
			</div>
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
				<Label for="sm-condition" class="mb-2">État</Label>
				<Select
					id="sm-condition"
					name="condition"
					form="stock-movement-form"
					placeholder=""
					items={[...STOCK_CONDITIONS]}
					value={data.placements[0]?.condition ?? 'new'}
				/>
			</div>
			<div>
				<Label for="sm-qty" class="mb-2">Quantité</Label>
				<Input id="sm-qty" name="quantity" form="stock-movement-form" type="number" value="1" />
			</div>
			<div>
				<Label for="sm-serial" class="mb-2">N° de série</Label>
				<Input
					id="sm-serial"
					name="serialNumber"
					form="stock-movement-form"
					placeholder="Une pièce à la fois"
				/>
			</div>
			<div>
				<Label for="sm-ref" class="mb-2">N° de pièce</Label>
				<Input id="sm-ref" name="reference" form="stock-movement-form" placeholder="BL, bon…" />
			</div>
			<div>
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
					<div class="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
						<div>
							<span class="font-medium text-gray-900">
								{movementLabels[mv.type] ?? mv.type}
							</span>
							<span class={mv.quantity >= 0 ? 'ms-2 text-green-600' : 'ms-2 text-red-600'}>
								{mv.quantity >= 0 ? '+' : ''}{mv.quantity}
							</span>
							{#if mv.locationId}
								{@const at = data.locations.find((l) => l.id === mv.locationId)}
								<span
									class="ms-2 cursor-help font-mono text-xs text-gray-700"
									title={at?.description ?? at?.path}>{at?.code ?? at?.name}</span
								>
							{/if}
							{#if mv.condition !== 'new'}
								<span class="ms-2 text-xs text-gray-600">{conditionLabel(mv.condition)}</span>
							{/if}
							{#if mv.serialNumber}
								<span class="ms-2 font-mono text-xs text-gray-600">N° {mv.serialNumber}</span>
							{/if}
							{#if mv.reference}
								<span class="ms-2 text-gray-500">{mv.reference}</span>
							{/if}
							{#if mv.note}
								<span class="ms-2 text-gray-500">— {mv.note}</span>
							{/if}
						</div>
						<span class="text-gray-400">{dateFmt.format(new Date(mv.createdAt))}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-gray-500">Aucun mouvement enregistré.</p>
		{/if}
	</Card>
{/snippet}

{#snippet supplyPanel()}
	<!--
		Approvisionnement (CDC 11, § 5.2) : fournisseurs du produit et leurs
		conditions. Le principal alimente le prix d'achat et la référence
		fournisseur de la fiche (R3). Les champs se rattachent aux formulaires
		déclarés plus bas (attribut form=…).
	-->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">
			Approvisionnement ({data.supply.length})
		</h2>
		{#if form?.supplyError}
			<p class="mb-3 text-sm text-red-600">{form.supplyError}</p>
		{/if}

		{#if data.supply.length === 0}
			<p class="mb-4 text-sm text-gray-500">Aucun fournisseur : ajoutez-en un ci-dessous.</p>
		{:else}
			<div class="mb-5 space-y-3">
				{#each data.supply as s (s.supplierId)}
					{@const f = `supply-${s.supplierId}`}
					<div class="rounded-lg border border-gray-200 p-3">
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<a href="/admin/suppliers/{s.supplierId}" class="font-medium hover:underline"
								>{s.name}</a
							>
							{#if s.isMain}<StateBadge color="green" label="Principal" />{/if}
							{#if !s.isActive}<StateBadge color="gray" label="Archivé" />{/if}
							<div class="ms-auto flex gap-1">
								{#if !s.isMain}
									<Button
										type="submit"
										form="supply-main-form"
										name="supplierId"
										value={s.supplierId}
										size="xs"
										color="alternative">Principal</Button
									>
								{/if}
								<Button
									type="submit"
									form="supply-remove-form"
									name="supplierId"
									value={s.supplierId}
									size="xs"
									color="red">Retirer</Button
								>
							</div>
						</div>
						<input type="hidden" form={f} name="supplierId" value={s.supplierId} />
						<div class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_5rem_5rem_auto]">
							<div>
								<Label for="{f}-ref" class="mb-1 text-xs">Réf. fournisseur</Label>
								<Input
									id="{f}-ref"
									form={f}
									name="supplierReference"
									size="sm"
									value={s.supplierReference ?? ''}
								/>
							</div>
							<div>
								<Label for="{f}-price" class="mb-1 text-xs">Prix d'achat HT</Label>
								<Input
									id="{f}-price"
									form={f}
									name="purchasePrice"
									size="sm"
									value={s.purchasePrice ? String(Number(s.purchasePrice)) : ''}
								/>
							</div>
							<div>
								<Label for="{f}-days" class="mb-1 text-xs">Délai (j)</Label>
								<Input
									id="{f}-days"
									form={f}
									name="deliveryDays"
									size="sm"
									type="number"
									min="0"
									value={s.deliveryDays ?? ''}
								/>
							</div>
							<div>
								<Label for="{f}-min" class="mb-1 text-xs">Qté min.</Label>
								<Input
									id="{f}-min"
									form={f}
									name="minQuantity"
									size="sm"
									type="number"
									min="0"
									value={s.minQuantity ?? ''}
								/>
							</div>
							<Button type="submit" form={f} size="sm" color="alternative">Enregistrer</Button>
						</div>
						<div class="mt-2">
							<Label for="{f}-desc" class="mb-1 text-xs">Désignation chez le fournisseur</Label>
							<Textarea
								id="{f}-desc"
								form={f}
								name="description"
								rows={s.description ? Math.min(6, s.description.split('\n').length) : 1}
								value={s.description ?? ''}
								placeholder="Conditionnement, caractéristiques, prix au rouleau…"
								class="text-xs"
							/>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<h3 class="mb-2 text-sm font-semibold text-gray-900">Ajouter un fournisseur</h3>
		<div
			class="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_5rem_5rem]"
		>
			<div>
				<Label for="supply-new" class="mb-1 text-xs">Fournisseur</Label>
				<Select
					id="supply-new"
					form="supply-add-form"
					name="supplierId"
					size="sm"
					placeholder="Choisir…"
					items={data.supplierOptions.filter(
						(o) => !data.supply.some((s) => String(s.supplierId) === o.value)
					)}
				/>
			</div>
			<div>
				<Label for="supply-new-ref" class="mb-1 text-xs">Réf. fournisseur</Label>
				<Input id="supply-new-ref" form="supply-add-form" name="supplierReference" size="sm" />
			</div>
			<div>
				<Label for="supply-new-price" class="mb-1 text-xs">Prix d'achat HT</Label>
				<Input id="supply-new-price" form="supply-add-form" name="purchasePrice" size="sm" />
			</div>
			<div>
				<Label for="supply-new-days" class="mb-1 text-xs">Délai (j)</Label>
				<Input
					id="supply-new-days"
					form="supply-add-form"
					name="deliveryDays"
					type="number"
					min="0"
					size="sm"
				/>
			</div>
			<div>
				<Label for="supply-new-min" class="mb-1 text-xs">Qté min.</Label>
				<Input
					id="supply-new-min"
					form="supply-add-form"
					name="minQuantity"
					type="number"
					min="0"
					size="sm"
				/>
			</div>
		</div>
		<div class="mt-3 flex items-center gap-3">
			<Toggle form="supply-add-form" name="isMain">Fournisseur principal</Toggle>
			<Button type="submit" form="supply-add-form" size="sm">
				<PlusOutline class="me-1 h-4 w-4" /> Ajouter
			</Button>
		</div>
	</Card>
{/snippet}

{#snippet variantsPanel()}
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">
			Déclinaisons ({p.variants.length})
		</h2>

		{#if p.variants.length > 0}
			<div class="mb-4 space-y-2">
				{#each p.variants as v (v.id)}
					<div class="flex items-center justify-between rounded-lg border border-gray-200 p-3">
						<div>
							<span class="font-medium text-gray-900">{v.name}</span>
							{#if v.isDefault}
								<span class="ms-2 text-xs text-cyan-600">(par défaut)</span>
							{/if}
							<span class="block text-sm text-gray-500">
								{attrText(v.attributes)} · Stock : {v.stock} · Impact prix : {v.priceImpact} €
							</span>
						</div>
						<Button
							type="submit"
							form="variant-delete-form"
							name="variantId"
							value={v.id}
							size="xs"
							color="red"
						>
							Supprimer
						</Button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="mb-4 text-sm text-gray-500">Aucune déclinaison.</p>
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
					class="w-full"
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
		<h2 class="mb-4 text-lg font-semibold text-gray-900">
			Images ({p.media.length})
		</h2>

		<div class="mb-4">
			<ProductMediaGrid media={p.media} productName={p.name} deleteFormId="media-delete-form" />
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

{#snippet relationsPanel()}
	<Card class="max-w-none p-6">
		<h2 class="mb-1 text-lg font-semibold text-gray-900">
			Produits associés ({p.relations.length})
		</h2>
		<p class="mb-4 text-xs text-gray-500">
			Affichés en bas de la fiche produit, sous « Vous aimerez aussi ». Repris de PrestaShop.
		</p>

		{#if p.relations.length === 0}
			<p class="text-sm text-gray-500">Aucun produit associé.</p>
		{:else}
			<ul class="divide-y divide-gray-100">
				{#each p.relations as relation (relation.id)}
					<li class="flex items-center justify-between gap-3 py-2">
						<div class="min-w-0">
							<a
								href="/admin/products/{relation.productId}"
								class="block truncate text-sm font-medium text-primary-700 hover:underline"
							>
								{relation.name}
							</a>
							<span class="text-xs text-gray-500">
								{relation.reference}
								{#if relation.type !== 'accessory'}· {relation.type}{/if}
								{#if !relation.isActive}· inactif{/if}
							</span>
						</div>
						<Button
							type="submit"
							form="relation-remove-form"
							name="relationId"
							value={relation.id}
							size="xs"
							color="alternative"
						>
							Retirer
						</Button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if form?.relationError}
			<p class="mt-3 text-sm text-red-600">{form.relationError}</p>
		{/if}

		<div class="mt-4 flex items-end gap-3">
			<div class="flex-1">
				<Label for="relation-ref" class="mb-2">Ajouter par référence</Label>
				<Input
					id="relation-ref"
					name="reference"
					form="relation-form"
					placeholder="Référence du produit à associer"
				/>
			</div>
			<Button type="submit" form="relation-form" size="sm">Associer</Button>
		</div>
	</Card>
{/snippet}

<ProductForm
	product={p}
	brandOptions={data.brandOptions}
	categoryTree={data.categoryTree}
	selectedCategoryIds={p.categoryIds}
	taxOptions={data.taxOptions}
	action="?/update"
	message={form?.message}
	submitLabel="Enregistrer"
	productId={p.id}
	{stockPanel}
	{variantsPanel}
	{mediaPanel}
	{relationsPanel}
	{supplyPanel}
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
<form
	id="supply-add-form"
	method="POST"
	action="?/saveSupply"
	use:enhance
	data-success="Fournisseur ajouté."
	class="hidden"
></form>
{#each data.supply as s (s.supplierId)}
	<form
		id="supply-{s.supplierId}"
		method="POST"
		action="?/saveSupply"
		use:enhance
		data-success="Conditions enregistrées."
		class="hidden"
	></form>
{/each}
<form
	id="supply-main-form"
	method="POST"
	action="?/mainSupply"
	use:enhance
	data-success="Fournisseur principal changé."
	class="hidden"
></form>
<form
	id="supply-remove-form"
	method="POST"
	action="?/removeSupply"
	use:enhance
	data-success="Fournisseur retiré."
	class="hidden"
></form>
<form id="media-form" method="POST" action="?/addMedia" use:enhance class="hidden"></form>
<form id="relation-form" method="POST" action="?/addRelation" use:enhance class="hidden"></form>
<!-- Suppressions par ligne : le bouton porte l'identifiant (name/value). -->
<form id="media-delete-form" method="POST" action="?/deleteMedia" use:enhance class="hidden"></form>
<form
	id="variant-delete-form"
	method="POST"
	action="?/deleteVariant"
	use:enhance
	class="hidden"
></form>
<form
	id="relation-remove-form"
	method="POST"
	action="?/removeRelation"
	use:enhance
	class="hidden"
></form>

<form
	method="POST"
	action="?/delete"
	bind:this={deleteForm}
	use:enhance
	data-success="Suppression effectuée."
	class="hidden"
></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le produit"
	message="Le produit, ses variantes et ses médias seront définitivement supprimés."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>

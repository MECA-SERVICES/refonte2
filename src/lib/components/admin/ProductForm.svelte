<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		Card,
		Label,
		Input,
		Textarea,
		Select,
		Toggle,
		Button,
		Alert,
		Tabs,
		TabItem
	} from 'flowbite-svelte';
	import {
		FileLinesOutline,
		DollarOutline,
		CubesStackedOutline,
		TruckOutline,
		SearchOutline,
		CogOutline,
		EyeOutline,
		ListOutline,
		ChartMixedOutline
	} from 'flowbite-svelte-icons';
	import TabPanel from './TabPanel.svelte';
	import type { Product } from '$lib/server/db/catalog.schema';
	import type { Snippet } from 'svelte';

	let {
		product,
		brandOptions,
		categoryOptions,
		taxOptions,
		message,
		submitLabel = 'Enregistrer',
		action,
		productId,
		stockPanel,
		variantsPanel,
		mediaPanel
	}: {
		product?: Partial<Product>;
		brandOptions: { value: string; name: string }[];
		categoryOptions: { value: string; name: string }[];
		taxOptions: { value: string; name: string; rate: number }[];
		message?: string;
		submitLabel?: string;
		action?: string;
		/** Renseigné en édition uniquement : active les liens de la colonne latérale. */
		productId?: number;
		/** Panneaux injectés par la page d'édition (absents à la création). */
		stockPanel?: Snippet;
		variantsPanel?: Snippet;
		mediaPanel?: Snippet;
	} = $props();

	function val(n: number | string | null | undefined): string {
		return n === null || n === undefined ? '' : String(n);
	}

	// Onglet courant. Piloté à la main (et non par `open` sur TabItem) car les
	// panneaux vivent hors de <Tabs> pour rester montés — cf. TabPanel.
	let selected = $state('general');

	// Prix HT saisi + taux sélectionné → aperçu TTC en direct.
	// untrack : on ne capture que la valeur initiale (le produit ne change pas pendant l'édition).
	let priceHt = $state(untrack(() => val(product?.priceHt)));
	let taxRuleId = $state(untrack(() => val(product?.taxRuleId)));
	let purchasePrice = $state(untrack(() => val(product?.purchasePrice)));
	let isActive = $state(untrack(() => product?.isActive ?? true));

	const selectedRate = $derived(taxOptions.find((t) => t.value === taxRuleId)?.rate ?? 0);
	const ttcPreview = $derived(
		priceHt && !Number.isNaN(Number(priceHt))
			? (Number(priceHt) * (1 + selectedRate / 100)).toFixed(2)
			: null
	);

	// Marge : PrestaShop l'affiche en permanence à côté du prix de vente.
	const margin = $derived.by(() => {
		const sale = Number(priceHt);
		const cost = Number(purchasePrice);
		if (!priceHt || !purchasePrice || Number.isNaN(sale) || Number.isNaN(cost) || sale <= 0) {
			return null;
		}
		return { amount: (sale - cost).toFixed(2), percent: (((sale - cost) / sale) * 100).toFixed(1) };
	});

	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

	// Pastille de stock du bandeau : vert / orange / rouge comme PrestaShop.
	const stockTone = $derived.by(() => {
		const s = product?.stock ?? 0;
		if (s <= 0) return 'bg-red-500';
		if (s < 5) return 'bg-yellow-400';
		return 'bg-green-500';
	});

	const tabItemClass = 'rounded-t-lg px-4 py-3 text-sm font-medium whitespace-nowrap';
</script>

<form method="POST" {action} use:enhance class="pb-24">
	{#if message}
		<Alert color="red" class="mb-4">{message}</Alert>
	{/if}

	<!--
		Bandeau de rappel : PrestaShop récapitule référence, stock et TVA en haut
		de la fiche, visible quel que soit l'onglet ouvert.
	-->
	<div
		class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<span class="text-gray-500 dark:text-gray-400">
			Référence :
			<span class="font-medium text-gray-900 dark:text-white">
				{product?.reference || '—'}
			</span>
		</span>
		<span class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
			Stock :
			<span class="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
				<span class="h-2 w-2 rounded-full {stockTone}"></span>
				{product?.stock ?? 0}
			</span>
		</span>
		<span class="text-gray-500 dark:text-gray-400">
			Prix TTC :
			<span class="font-medium text-gray-900 dark:text-white">
				{ttcPreview ? `${ttcPreview} €` : '—'}
			</span>
		</span>
		<span class="text-gray-500 dark:text-gray-400">
			TVA :
			<span class="font-medium text-gray-900 dark:text-white">{selectedRate} %</span>
		</span>
	</div>

	<!--
		Barre d'onglets PrestaShop (ordre officiel : Paramètres de base, Quantités,
		Livraison, Tarifs, SEO, Options). Les <TabItem> ne portent pas de contenu :
		ils ne servent qu'à la navigation, les panneaux sont rendus plus bas.
	-->
	<Tabs
		tabStyle="underline"
		class="flex-nowrap overflow-x-auto border-b border-gray-200 dark:border-gray-700"
		contentClass="hidden"
		divider={false}
	>
		<TabItem
			open={selected === 'general'}
			onclick={() => (selected = 'general')}
			class={tabItemClass}
		>
			{#snippet titleSlot()}
				<span class="flex items-center gap-2"
					><FileLinesOutline class="h-4 w-4" /> Paramètres de base</span
				>
			{/snippet}
		</TabItem>
		<TabItem open={selected === 'stock'} onclick={() => (selected = 'stock')} class={tabItemClass}>
			{#snippet titleSlot()}
				<span class="flex items-center gap-2"
					><CubesStackedOutline class="h-4 w-4" /> Quantités</span
				>
			{/snippet}
		</TabItem>
		<TabItem
			open={selected === 'shipping'}
			onclick={() => (selected = 'shipping')}
			class={tabItemClass}
		>
			{#snippet titleSlot()}
				<span class="flex items-center gap-2"><TruckOutline class="h-4 w-4" /> Livraison</span>
			{/snippet}
		</TabItem>
		<TabItem open={selected === 'price'} onclick={() => (selected = 'price')} class={tabItemClass}>
			{#snippet titleSlot()}
				<span class="flex items-center gap-2"><DollarOutline class="h-4 w-4" /> Tarifs</span>
			{/snippet}
		</TabItem>
		<TabItem open={selected === 'seo'} onclick={() => (selected = 'seo')} class={tabItemClass}>
			{#snippet titleSlot()}
				<span class="flex items-center gap-2"><SearchOutline class="h-4 w-4" /> SEO</span>
			{/snippet}
		</TabItem>
		<TabItem
			open={selected === 'options'}
			onclick={() => (selected = 'options')}
			class={tabItemClass}
		>
			{#snippet titleSlot()}
				<span class="flex items-center gap-2"><CogOutline class="h-4 w-4" /> Options</span>
			{/snippet}
		</TabItem>
	</Tabs>

	<!--
		Deux colonnes comme PrestaShop : le formulaire à gauche, les actions et
		raccourcis contextuels dans la colonne de droite (empilée sous le
		formulaire en dessous de lg).
	-->
	<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
		<div>
			<!-- ===== Paramètres de base ===== -->
			<TabPanel id="general" {selected}>
				<!-- Les images en premier, en haut à gauche : c'est la disposition PrestaShop. -->
				{#if mediaPanel}
					{@render mediaPanel()}
				{/if}

				<Card class="max-w-none p-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="sm:col-span-2">
							<Label for="name" class="mb-2">Nom du produit</Label>
							<Input id="name" name="name" required value={product?.name ?? ''} />
						</div>
						<div>
							<Label for="reference" class="mb-2">Référence (SKU)</Label>
							<Input id="reference" name="reference" required value={product?.reference ?? ''} />
						</div>
						<div>
							<Label for="supplierReference" class="mb-2">Référence fournisseur</Label>
							<Input
								id="supplierReference"
								name="supplierReference"
								value={product?.supplierReference ?? ''}
							/>
						</div>
						<div>
							<Label for="ean13" class="mb-2">Code-barres (EAN13)</Label>
							<Input id="ean13" name="ean13" value={product?.ean13 ?? ''} maxlength={13} />
						</div>
						<div>
							<Label for="brandId" class="mb-2">Marque</Label>
							<Select
								id="brandId"
								name="brandId"
								placeholder=""
								value={val(product?.brandId)}
								items={[{ value: '', name: 'Aucune' }, ...brandOptions]}
							/>
						</div>
						<div class="sm:col-span-2">
							<Label for="categoryId" class="mb-2">Catégorie principale</Label>
							<Select
								id="categoryId"
								name="categoryId"
								placeholder=""
								value={val(product?.categoryId)}
								items={[{ value: '', name: 'Aucune' }, ...categoryOptions]}
							/>
						</div>
					</div>
				</Card>

				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Description</h2>
					<div class="space-y-4">
						<div>
							<Label for="shortDescription" class="mb-2">Résumé</Label>
							<Textarea
								id="shortDescription"
								name="shortDescription"
								rows={2}
								value={product?.shortDescription ?? ''}
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Affiché en haut de la fiche produit, sous le nom.
							</p>
						</div>
						<div>
							<Label for="description" class="mb-2">Description</Label>
							<Textarea
								id="description"
								name="description"
								rows={6}
								value={product?.description ?? ''}
							/>
						</div>
					</div>
				</Card>
			</TabPanel>

			<!-- ===== Quantités ===== -->
			<TabPanel id="stock" {selected}>
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quantités</h2>
					<div class="grid gap-4 sm:grid-cols-3">
						<div>
							<Label for="stock" class="mb-2">Quantité en stock</Label>
							<Input
								id="stock"
								name="stock"
								type="number"
								value={val(product?.stock ?? 0)}
								disabled={!!stockPanel}
							/>
							{#if stockPanel}
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Piloté par les mouvements de stock ci-dessous.
								</p>
							{/if}
						</div>
					</div>
				</Card>

				{#if stockPanel}
					{@render stockPanel()}
				{/if}

				{#if variantsPanel}
					{@render variantsPanel()}
				{/if}
			</TabPanel>

			<!-- ===== Livraison ===== -->
			<TabPanel id="shipping" {selected}>
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
						Dimensions du colis
					</h2>
					<div class="grid gap-4 sm:grid-cols-4">
						<div>
							<Label for="widthCm" class="mb-2">Largeur (cm)</Label>
							<Input
								id="widthCm"
								name="widthCm"
								type="number"
								step="0.01"
								value={val(product?.widthCm)}
							/>
						</div>
						<div>
							<Label for="heightCm" class="mb-2">Hauteur (cm)</Label>
							<Input
								id="heightCm"
								name="heightCm"
								type="number"
								step="0.01"
								value={val(product?.heightCm)}
							/>
						</div>
						<div>
							<Label for="lengthCm" class="mb-2">Profondeur (cm)</Label>
							<Input
								id="lengthCm"
								name="lengthCm"
								type="number"
								step="0.01"
								value={val(product?.lengthCm)}
							/>
						</div>
						<div>
							<Label for="weightKg" class="mb-2">Poids (kg)</Label>
							<Input
								id="weightKg"
								name="weightKg"
								type="number"
								step="0.001"
								value={val(product?.weightKg)}
							/>
						</div>
					</div>
				</Card>

				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Frais de port</h2>
					<div class="grid gap-4 sm:grid-cols-3">
						<div>
							<Label for="shippingExtraFee" class="mb-2">Frais de port supplémentaires (€)</Label>
							<Input
								id="shippingExtraFee"
								name="shippingExtraFee"
								type="number"
								step="0.01"
								value={val(product?.shippingExtraFee)}
							/>
						</div>
					</div>
				</Card>
			</TabPanel>

			<!-- ===== Tarifs ===== -->
			<TabPanel id="price" {selected}>
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Prix de vente</h2>
					<div class="grid gap-4 sm:grid-cols-3">
						<div>
							<Label for="priceHt" class="mb-2">Prix HT (€)</Label>
							<Input
								id="priceHt"
								name="priceHt"
								type="number"
								step="0.01"
								required
								bind:value={priceHt}
							/>
						</div>
						<div>
							<Label for="taxRuleId" class="mb-2">Règle de TVA</Label>
							<Select
								id="taxRuleId"
								name="taxRuleId"
								placeholder=""
								bind:value={taxRuleId}
								items={[
									{ value: '', name: 'Aucune' },
									...taxOptions.map((t) => ({ value: t.value, name: t.name }))
								]}
							/>
						</div>
						<div>
							<Label class="mb-2">Prix TTC</Label>
							<div
								class="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
							>
								{ttcPreview ? `${ttcPreview} €` : '—'}
							</div>
						</div>
						<div>
							<Label for="priceHtStrike" class="mb-2">Prix barré HT (€)</Label>
							<Input
								id="priceHtStrike"
								name="priceHtStrike"
								type="number"
								step="0.01"
								value={val(product?.priceHtStrike)}
							/>
						</div>
						<div>
							<Label for="purchasePrice" class="mb-2">Prix d'achat HT (€)</Label>
							<Input
								id="purchasePrice"
								name="purchasePrice"
								type="number"
								step="0.01"
								bind:value={purchasePrice}
							/>
						</div>
					</div>
				</Card>

				<!-- Récapitulatif de marge, comme le bloc « Résumé des coûts » de PrestaShop. -->
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Marge</h2>
					{#if margin}
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
								<span class="block text-xs text-gray-500 uppercase dark:text-gray-400">
									Marge brute HT
								</span>
								<span class="mt-1 block text-xl font-semibold text-gray-900 dark:text-white">
									{eur.format(Number(margin.amount))}
								</span>
							</div>
							<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
								<span class="block text-xs text-gray-500 uppercase dark:text-gray-400">
									Taux de marge
								</span>
								<span class="mt-1 block text-xl font-semibold text-gray-900 dark:text-white">
									{margin.percent} %
								</span>
							</div>
						</div>
					{:else}
						<p class="text-sm text-gray-500 dark:text-gray-400">
							Renseignez le prix d'achat et le prix de vente pour calculer la marge.
						</p>
					{/if}
				</Card>
			</TabPanel>

			<!-- ===== SEO ===== -->
			<TabPanel id="seo" {selected}>
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
						Optimisation pour les moteurs de recherche
					</h2>
					<div class="space-y-4">
						<div>
							<Label for="metaTitle" class="mb-2">Balise title</Label>
							<Input id="metaTitle" name="metaTitle" value={product?.metaTitle ?? ''} />
						</div>
						<div>
							<Label for="metaDescription" class="mb-2">Meta description</Label>
							<Textarea
								id="metaDescription"
								name="metaDescription"
								rows={3}
								value={product?.metaDescription ?? ''}
							/>
						</div>
						<div>
							<Label for="slug" class="mb-2">URL simplifiée</Label>
							<Input id="slug" name="slug" value={product?.slug ?? ''} />
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Laissez vide pour la générer depuis le nom du produit.
							</p>
						</div>
					</div>
				</Card>
			</TabPanel>

			<!-- ===== Options ===== -->
			<TabPanel id="options" {selected}>
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Visibilité</h2>
					<div class="space-y-4">
						<Toggle bind:checked={isActive}>Produit actif</Toggle>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Un produit inactif reste accessible en administration mais disparaît de la boutique.
						</p>
					</div>
				</Card>

				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Références</h2>
					<div class="grid gap-4 text-sm sm:grid-cols-2">
						<div class="flex justify-between border-b border-gray-100 py-2 dark:border-gray-800">
							<span class="text-gray-500 dark:text-gray-400">Identifiant</span>
							<span class="font-medium text-gray-900 dark:text-white">{productId ?? '—'}</span>
						</div>
						<div class="flex justify-between border-b border-gray-100 py-2 dark:border-gray-800">
							<span class="text-gray-500 dark:text-gray-400">Code-barres</span>
							<span class="font-medium text-gray-900 dark:text-white">
								{product?.ean13 || '—'}
							</span>
						</div>
					</div>
				</Card>
			</TabPanel>
		</div>

		<!--
			Colonne latérale PrestaShop : état de publication + raccourcis. Sticky pour
			rester visible pendant le défilement du formulaire.
		-->
		<aside class="space-y-4 lg:sticky lg:top-4">
			<Card class="max-w-none p-4">
				<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Publication</h3>
				<Toggle bind:checked={isActive}>
					{isActive ? 'En ligne' : 'Hors ligne'}
				</Toggle>
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					{isActive
						? 'Le produit est visible dans la boutique.'
						: 'Le produit est masqué de la boutique.'}
				</p>
			</Card>

			{#if productId}
				<Card class="max-w-none p-4">
					<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Raccourcis</h3>
					<div class="flex flex-col gap-2">
						<Button size="sm" color="alternative" href="/admin/products" class="justify-start">
							<ListOutline class="me-2 h-4 w-4" /> Liste des produits
						</Button>
						<Button size="sm" color="alternative" href="/admin/products/new" class="justify-start">
							<EyeOutline class="me-2 h-4 w-4" /> Nouveau produit
						</Button>
					</div>
				</Card>

				<Card class="max-w-none p-4">
					<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Résumé</h3>
					<dl class="space-y-2 text-sm">
						<div class="flex items-center justify-between">
							<dt class="text-gray-500 dark:text-gray-400">Prix HT</dt>
							<dd class="font-medium text-gray-900 dark:text-white">
								{priceHt ? eur.format(Number(priceHt)) : '—'}
							</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-gray-500 dark:text-gray-400">Prix TTC</dt>
							<dd class="font-medium text-gray-900 dark:text-white">
								{ttcPreview ? `${ttcPreview} €` : '—'}
							</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
								<ChartMixedOutline class="h-4 w-4" /> Marge
							</dt>
							<dd class="font-medium text-gray-900 dark:text-white">
								{margin ? `${margin.percent} %` : '—'}
							</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-gray-500 dark:text-gray-400">Stock</dt>
							<dd class="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
								<span class="h-2 w-2 rounded-full {stockTone}"></span>
								{product?.stock ?? 0}
							</dd>
						</div>
					</dl>
				</Card>
			{/if}
		</aside>
	</div>

	<!--
		L'état de publication est piloté par les interrupteurs ci-dessus ; ce champ
		caché porte la valeur réelle envoyée au serveur.
	-->
	{#if isActive}
		<input type="hidden" name="isActive" value="on" />
	{/if}

	<!--
		Barre d'action fixe : PrestaShop garde l'enregistrement accessible quel que
		soit l'onglet ouvert.
	-->
	<div
		class="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
	>
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
			<span class="text-sm text-gray-500 dark:text-gray-400">
				{isActive ? 'Ce produit sera visible en boutique.' : 'Ce produit restera hors ligne.'}
			</span>
			<div class="flex items-center gap-3">
				<Button color="alternative" href="/admin/products">Annuler</Button>
				<Button type="submit">{isActive ? `${submitLabel} et publier` : submitLabel}</Button>
			</div>
		</div>
	</div>
</form>

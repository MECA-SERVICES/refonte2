<script lang="ts">
	import { computeTtc, formatPrice } from '$lib/money';
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
		ArrowUpRightFromSquareOutline,
		ListOutline,
		ChartMixedOutline
	} from 'flowbite-svelte-icons';
	import TabPanel from './TabPanel.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import type { Product } from '$lib/server/db/catalog.schema';
	import type { Snippet } from 'svelte';

	let {
		product,
		brandOptions,
		categoryTree,
		selectedCategoryIds: initialCategoryIds = [],
		taxOptions,
		message,
		submitLabel = 'Enregistrer',
		action,
		productId,
		stockPanel,
		variantsPanel,
		mediaPanel,
		relationsPanel
	}: {
		product?: Partial<Product>;
		brandOptions: { value: string; name: string }[];
		/** Catégories à plat (avec parentId) pour reconstruire l'arborescence. */
		categoryTree: { id: number; name: string; parentId: number | null }[];
		/** Catégories additionnelles déjà rattachées au produit. */
		selectedCategoryIds?: number[];
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
		relationsPanel?: Snippet;
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
	let availableForOrder = $state(untrack(() => product?.availableForOrder ?? true));
	// Lié pour alimenter le compteur de caractères du résumé.
	let shortDescription = $state(untrack(() => product?.shortDescription ?? ''));
	/** Sous-onglet du bloc de description : « summary » ou « full ». */
	let descTab = $state('summary');
	let mainCategoryId = $state(untrack(() => val(product?.categoryId)));
	let selectedCategoryIds = $state(untrack(() => [...initialCategoryIds]));

	const selectedRate = $derived(taxOptions.find((t) => t.value === taxRuleId)?.rate ?? 0);
	const ttcPreview = $derived(
		priceHt && !Number.isNaN(Number(priceHt))
			? formatPrice(computeTtc(priceHt, selectedRate))
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

	// Pastille de stock du bandeau : vert / orange / rouge comme PrestaShop.
	const stockTone = $derived.by(() => {
		const s = product?.stock ?? 0;
		if (s <= 0) return 'bg-red-500';
		if (s < 5) return 'bg-yellow-400';
		return 'bg-green-500';
	});

	const tabItemClass = 'rounded-t-lg px-4 py-3 text-sm font-medium whitespace-nowrap';
</script>

<!--
	Renvoi vers l'onglet qui porte le détail d'un réglage, comme le
	« Paramètres avancés dans → … » de PrestaShop. Un bouton plutôt qu'un lien :
	la cible est un panneau de la même page, pas une adresse.
-->
{#snippet advancedLink(label: string, tab: string)}
	<button
		type="button"
		onclick={() => (selected = tab)}
		class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
	>
		Paramètres avancés dans
		<span class="inline-flex items-center gap-1">
			<ArrowUpRightFromSquareOutline class="h-3 w-3" />
			{label}
		</span>
	</button>
{/snippet}

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
				{ttcPreview ?? '—'}
			</span>
		</span>
		<span class="text-gray-500 dark:text-gray-400">
			TVA :
			<span class="font-medium text-gray-900 dark:text-white">{selectedRate} %</span>
		</span>
	</div>

	<!--
		Barre d'onglets PrestaShop (ordre et libellés officiels : Essentiel,
		Quantités, Livraison, Prix, Référencement - SEO, Options). Les <TabItem>
		ne portent pas de contenu : ils ne servent qu'à la navigation, les
		panneaux sont rendus plus bas.

		L'onglet « Modules » de PrestaShop n'a pas d'équivalent ici — MSShop n'a
		pas d'architecture de modules — et un onglet vide dégraderait l'écran
		plutôt que de le rapprocher du modèle.
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
				<span class="flex items-center gap-2"><FileLinesOutline class="h-4 w-4" /> Essentiel</span>
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
				<span class="flex items-center gap-2"><DollarOutline class="h-4 w-4" /> Prix</span>
			{/snippet}
		</TabItem>
		<TabItem open={selected === 'seo'} onclick={() => (selected = 'seo')} class={tabItemClass}>
			{#snippet titleSlot()}
				<span class="flex items-center gap-2"
					><SearchOutline class="h-4 w-4" /> Référencement - SEO</span
				>
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
		raccourcis contextuels dans la colonne de droite.
		
		Le seuil est `xl` et non `lg` : à 1024 px, réserver 20rem à la colonne
		latérale ne laissait pas de quoi saisir une description confortablement.
		En dessous, la colonne passe sous le formulaire et chaque champ retrouve
		toute la largeur.
	-->
	<div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
		<div>
			<!-- ===== Essentiel ===== -->
			<TabPanel id="general" {selected}>
				<!--
					Ordre de l'onglet « Essentiel » de PrestaShop 1.7 : nom, images,
					récapitulatif / description, marque, produits associés.

					Référence, quantité, prix et catégories vivent dans la colonne
					latérale, à droite — c'est là que PrestaShop les place, et ils
					n'apparaissent que sur cet onglet.

					Les autres références (EAN, fournisseur) restent dans « Options ».
				-->
				<Card class="max-w-none p-6">
					<div>
						<Label for="name" class="mb-2">Nom du produit</Label>
						<Input id="name" name="name" required value={product?.name ?? ''} />
					</div>
				</Card>

				{#if mediaPanel}
					{@render mediaPanel()}
				{/if}

				<!--
					Récapitulatif et Description en sous-onglets, comme PrestaShop :
					les deux champs occupent la même place et se consultent l'un
					après l'autre. Les deux restent dans le DOM — c'est un
					formulaire mono-soumission.
				-->
				<Card class="max-w-none p-0">
					<div class="flex border-b border-gray-200 dark:border-gray-700">
						{#each [{ id: 'summary', label: 'Récapitulatif' }, { id: 'full', label: 'Description' }] as t (t.id)}
							<button
								type="button"
								onclick={() => (descTab = t.id)}
								class="border-b-2 px-5 py-3 text-sm font-medium transition-colors {descTab === t.id
									? 'border-primary-600 text-primary-700 dark:border-primary-500 dark:text-primary-400'
									: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
							>
								{t.label}
							</button>
						{/each}
					</div>

					<div class="p-6">
						<div class={descTab === 'summary' ? '' : 'hidden'}>
							<Textarea
								id="shortDescription"
								name="shortDescription"
								rows={6}
								bind:value={shortDescription}
								placeholder="Quelques lignes reprises en haut de la fiche produit."
							/>
							<div class="mt-1 flex flex-wrap items-baseline justify-between gap-2">
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Affiché en haut de la fiche produit, sous le nom.
								</p>
								<!-- Compteur façon PrestaShop : le résumé alimente les listes
								     et les balises meta, sa longueur se surveille. -->
								<p class="text-xs text-gray-400 dark:text-gray-500">
									{shortDescription.length} caractère{shortDescription.length > 1 ? 's' : ''}
								</p>
							</div>
						</div>

						<div class={descTab === 'full' ? '' : 'hidden'}>
							<Textarea
								id="description"
								name="description"
								rows={12}
								value={product?.description ?? ''}
								placeholder="Description complète, affichée dans l'onglet « Description » de la fiche."
							/>
						</div>
					</div>
				</Card>

				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Marque</h2>
					<Select
						id="brandId"
						name="brandId"
						placeholder=""
						value={val(product?.brandId)}
						items={[{ value: '', name: 'Aucune' }, ...brandOptions]}
					/>
				</Card>

				<!-- Produits associés : sous la marque chez PrestaShop, pas dans
				     « Options ». -->
				{#if relationsPanel}
					{@render relationsPanel()}
				{/if}
			</TabPanel>

			<!-- ===== Quantités ===== -->
			<TabPanel id="stock" {selected}>
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quantités</h2>
					<div class="grid gap-4 sm:grid-cols-2">
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
					<div class="grid gap-4 sm:grid-cols-2">
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
				<!-- Ordre PrestaShop : prix d'achat, puis prix de vente, écotaxe, TVA. -->
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Prix d'achat</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<Label for="purchasePrice" class="mb-2">Prix d'achat HT (€)</Label>
							<Input
								id="purchasePrice"
								name="purchasePrice"
								type="number"
								step="0.01"
								bind:value={purchasePrice}
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Jamais affiché en boutique. Sert au calcul de la marge.
							</p>
						</div>
					</div>
				</Card>

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
								{ttcPreview ?? '—'}
							</div>
						</div>
						<div>
							<Label for="ecotax" class="mb-2">Écotaxe TTC (€)</Label>
							<Input
								id="ecotax"
								name="ecotax"
								type="number"
								step="0.01"
								min="0"
								value={val(product?.ecotax)}
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Incluse dans le prix affiché, détaillée sur la fiche produit.
							</p>
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
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Prix de référence barré, pour une promotion.
							</p>
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
									{formatPrice(Number(margin.amount))}
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

						<!--
							Champ caché : une case décochée n'est pas envoyée par le
							navigateur. Sans lui, impossible de distinguer « décoché »
							de « absent du formulaire ».
						-->
						<input type="hidden" name="availableForOrder" value={availableForOrder ? 'on' : ''} />
						<Toggle bind:checked={availableForOrder}>Disponible à la commande</Toggle>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Décoché, le produit reste visible en boutique mais ne peut pas être ajouté au panier.
							Utile pour une pièce présentée au catalogue sans être vendue en ligne.
						</p>
					</div>
				</Card>

				<!-- Les références sont dans « Options » chez PrestaShop 1.7. -->
				<Card class="max-w-none p-6">
					<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Références</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<Label for="ean13" class="mb-2">Code-barres (EAN13)</Label>
							<Input id="ean13" name="ean13" value={product?.ean13 ?? ''} maxlength={13} />
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
							<Label class="mb-2">Identifiant</Label>
							<div
								class="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
							>
								{productId ?? '—'}
							</div>
						</div>
					</div>
				</Card>
			</TabPanel>
		</div>

		<!--
			Colonne latérale PrestaShop : état de publication + raccourcis. Sticky pour
			rester visible pendant le défilement du formulaire.
		-->
		<aside class="space-y-4 xl:sticky xl:top-4">
			<!--
				Sur l'onglet « Essentiel », PrestaShop place dans cette colonne les
				réglages qu'on consulte en permanence : référence, quantité, prix,
				catégories.

				Masqué par `hidden`, jamais démonté : la référence est `required` et
				n'existe qu'ici. Un `{#if}` la retirerait du DOM sur les autres
				onglets, donc du FormData — le serveur l'écraserait à
				l'enregistrement. Même raison que pour TabPanel.
			-->
			<div class={selected === 'general' ? 'space-y-4' : 'hidden'} inert={selected !== 'general'}>
				<Card class="max-w-none p-4">
					<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Référence</h3>
					<Input id="reference" name="reference" required value={product?.reference ?? ''} />
				</Card>

				<Card class="max-w-none p-4">
					<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Quantité</h3>
					<!--
						Raccourci de lecture : la saisie qui fait foi est celle de
						l'onglet « Quantités ». Sans `name`, ce champ n'est pas envoyé
						et ne peut pas écraser l'autre.
					-->
					<Input
						type="number"
						value={val(product?.stock ?? 0)}
						disabled
						aria-label="Quantité en stock"
					/>
					{@render advancedLink('Quantités', 'stock')}
				</Card>

				<Card class="max-w-none p-4">
					<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Prix</h3>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<Label for="priceHtQuick" class="mb-1.5 text-xs">HT</Label>
							<Input id="priceHtQuick" type="number" step="0.01" bind:value={priceHt} />
						</div>
						<div>
							<Label class="mb-1.5 text-xs">TTC</Label>
							<div
								class="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
							>
								{ttcPreview ?? '—'}
							</div>
						</div>
					</div>
					<div class="mt-3">
						<Label for="taxRuleIdQuick" class="mb-1.5 text-xs">Règle de taxe</Label>
						<!-- Lié à l'onglet « Prix » par `bind:` ; c'est là-bas que le
						     champ porte le `name` envoyé au serveur. -->
						<Select
							id="taxRuleIdQuick"
							placeholder=""
							bind:value={taxRuleId}
							items={[
								{ value: '', name: 'Aucune' },
								...taxOptions.map((t) => ({ value: t.value, name: t.name }))
							]}
						/>
					</div>
					{@render advancedLink('Prix', 'price')}
				</Card>

				<Card class="max-w-none p-4">
					<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Catégories</h3>
					<CategoryPicker
						categories={categoryTree}
						bind:mainCategoryId
						bind:selectedIds={selectedCategoryIds}
					/>
				</Card>
			</div>

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
								{priceHt ? formatPrice(Number(priceHt)) : '—'}
							</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-gray-500 dark:text-gray-400">Prix TTC</dt>
							<dd class="font-medium text-gray-900 dark:text-white">
								{ttcPreview ?? '—'}
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
						<div class="flex items-center justify-between">
							<dt class="text-gray-500 dark:text-gray-400">Catégories</dt>
							<dd class="font-medium text-gray-900 dark:text-white">
								{selectedCategoryIds.length + (mainCategoryId ? 1 : 0)}
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

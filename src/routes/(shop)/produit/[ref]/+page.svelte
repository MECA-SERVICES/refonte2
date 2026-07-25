<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Badge,
		Breadcrumb,
		BreadcrumbItem,
		Button,
		Input,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		Tabs,
		TabItem
	} from 'flowbite-svelte';
	import { CartPlusOutline, ImageOutline } from 'flowbite-svelte-icons';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import { formatPrice } from '$lib/shop';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const product = $derived(data.product);
	const images = $derived(product.media.filter((m) => m.type === 'image'));
	const documents = $derived(product.media.filter((m) => m.type === 'pdf'));

	let selectedImage = $state(0);
	let quantity = $state(1);

	const tabClasses = {
		active: 'inline-block p-4 font-semibold text-shop-red border-b-2 border-shop-red',
		inactive:
			'inline-block p-4 border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-600'
	};
</script>

<svelte:head>
	<title>{product.metaTitle ?? product.name} · MS Shop</title>
	{#if product.metaDescription}
		<meta name="description" content={product.metaDescription} />
	{/if}
</svelte:head>

<Breadcrumb class="mb-4">
	<BreadcrumbItem home href={resolve('/')}>Accueil</BreadcrumbItem>
	{#each product.breadcrumb as crumb (crumb.id)}
		<BreadcrumbItem href={resolve('/(shop)/categorie/[slug]', { slug: crumb.slug })}>
			{crumb.name}
		</BreadcrumbItem>
	{/each}
	<BreadcrumbItem>{product.name}</BreadcrumbItem>
</Breadcrumb>

<div class="grid gap-8 rounded-lg bg-white p-6 shadow-sm lg:grid-cols-2">
	<!-- Galerie -->
	<div>
		<div
			class="flex h-80 items-center justify-center overflow-hidden rounded border border-gray-100"
		>
			{#if images[selectedImage]}
				<img
					src={images[selectedImage].url}
					alt={images[selectedImage].alt ?? product.name}
					class="max-h-full max-w-full object-contain"
				/>
			{:else}
				<ImageOutline class="h-20 w-20 text-gray-300" />
			{/if}
		</div>
		{#if images.length > 1}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each images as image, i (image.id)}
					<button
						type="button"
						class="h-16 w-16 overflow-hidden rounded border p-1 {i === selectedImage
							? 'border-shop-blue ring-1 ring-shop-blue'
							: 'border-gray-200 hover:border-gray-400'}"
						onclick={() => (selectedImage = i)}
						aria-label="Image {i + 1}"
					>
						<img
							src={image.url}
							alt={image.alt ?? ''}
							class="h-full w-full object-contain"
							loading="lazy"
						/>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Informations & achat -->
	<div>
		{#if product.brandName}
			<p class="text-sm font-medium tracking-wide text-gray-500 uppercase">{product.brandName}</p>
		{/if}
		<h1 class="mt-1 text-2xl font-bold text-gray-900">{product.name}</h1>
		<p class="mt-2 text-sm text-gray-500">
			Référence : <span class="font-medium text-gray-700">{product.reference}</span>
		</p>

		{#if product.shortDescription}
			<p class="mt-4 text-sm leading-6 text-gray-700">{product.shortDescription}</p>
		{/if}

		<!-- Prix : rouge sur la fiche produit, comme sur l'ancienne boutique -->
		<div class="mt-6 flex items-baseline gap-3">
			<span class="text-3xl font-black text-shop-red">{formatPrice(product.priceTtc)}</span>
			{#if product.priceTtcStrike}
				<span class="text-lg text-gray-400 line-through">
					{formatPrice(product.priceTtcStrike)}
				</span>
			{/if}
			<span class="text-sm text-gray-500">TTC</span>
		</div>
		{#if product.taxRate}
			<p class="mt-1 text-xs text-gray-400">
				{formatPrice(product.priceHt)} HT — TVA {Number(product.taxRate)} %
			</p>
		{/if}

		<div class="mt-4">
			{#if product.stock > 0}
				<Badge color="green" rounded>En stock</Badge>
			{:else}
				<Badge color="red" rounded>Sur commande</Badge>
			{/if}
		</div>

		<div class="mt-6 flex items-center gap-3">
			<Input type="number" min="1" bind:value={quantity} class="w-24" aria-label="Quantité" />
			<!-- Squelette : le panier n'est pas encore branché. -->
			<Button
				disabled
				class="bg-shop-red focus-within:ring-red-300 hover:bg-shop-red-dark disabled:opacity-60"
			>
				<CartPlusOutline class="me-2 h-5 w-5" /> Ajouter au panier
			</Button>
		</div>
		<p class="mt-2 text-xs text-gray-400">Commande en ligne bientôt disponible.</p>

		{#if documents.length > 0}
			<div class="mt-6">
				<h2 class="text-sm font-semibold text-gray-700">Documents</h2>
				<ul class="mt-1 list-inside list-disc text-sm">
					{#each documents as doc (doc.id)}
						<li>
							<!-- rel="external" : URL du stockage des médias, pas une route interne. -->
							<a
								href={doc.url}
								target="_blank"
								rel="external noopener"
								class="text-shop-blue hover:underline"
							>
								{doc.alt ?? 'Document PDF (vue éclatée, notice…)'}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</div>

<!-- Onglets détails / fiche technique / variantes -->
<div class="mt-6 rounded-lg bg-white p-6 shadow-sm">
	<Tabs tabStyle="underline" class="border-b border-gray-200">
		<TabItem open activeClass={tabClasses.active} inactiveClass={tabClasses.inactive}>
			{#snippet titleSlot()}Détails du produit{/snippet}
			{#if product.description}
				<!-- Descriptions reprises de PrestaShop : HTML rédigé par nos soins en back-office. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="prose prose-sm mt-4 max-w-none">{@html product.description}</div>
			{:else}
				<p class="mt-4 text-sm text-gray-500">Pas de description détaillée pour ce produit.</p>
			{/if}
		</TabItem>
		<TabItem activeClass={tabClasses.active} inactiveClass={tabClasses.inactive}>
			{#snippet titleSlot()}Fiche technique{/snippet}
			<Table class="mt-4">
				<TableBody>
					<TableBodyRow>
						<TableBodyCell class="font-medium">Référence</TableBodyCell>
						<TableBodyCell>{product.reference}</TableBodyCell>
					</TableBodyRow>
					{#if product.supplierReference}
						<TableBodyRow>
							<TableBodyCell class="font-medium">Référence fournisseur</TableBodyCell>
							<TableBodyCell>{product.supplierReference}</TableBodyCell>
						</TableBodyRow>
					{/if}
					{#if product.ean13}
						<TableBodyRow>
							<TableBodyCell class="font-medium">EAN13</TableBodyCell>
							<TableBodyCell>{product.ean13}</TableBodyCell>
						</TableBodyRow>
					{/if}
					{#if product.brandName}
						<TableBodyRow>
							<TableBodyCell class="font-medium">Marque</TableBodyCell>
							<TableBodyCell>{product.brandName}</TableBodyCell>
						</TableBodyRow>
					{/if}
					{#if product.weightKg}
						<TableBodyRow>
							<TableBodyCell class="font-medium">Poids</TableBodyCell>
							<TableBodyCell>{Number(product.weightKg)} kg</TableBodyCell>
						</TableBodyRow>
					{/if}
				</TableBody>
			</Table>
		</TabItem>
		{#if product.variants.length > 0}
			<TabItem activeClass={tabClasses.active} inactiveClass={tabClasses.inactive}>
				{#snippet titleSlot()}Déclinaisons ({product.variants.length}){/snippet}
				<Table class="mt-4">
					<TableBody>
						{#each product.variants as variant (variant.id)}
							<TableBodyRow>
								<TableBodyCell class="font-medium">{variant.name}</TableBodyCell>
								<TableBodyCell>{variant.reference ?? '—'}</TableBodyCell>
								<TableBodyCell>
									{Number(variant.priceImpact) === 0
										? 'Même prix'
										: `${Number(variant.priceImpact) > 0 ? '+' : ''}${formatPrice(variant.priceImpact)} HT`}
								</TableBodyCell>
								<TableBodyCell>
									{variant.stock > 0 ? 'En stock' : 'Sur commande'}
								</TableBodyCell>
							</TableBodyRow>
						{/each}
					</TableBody>
				</Table>
			</TabItem>
		{/if}
	</Tabs>
</div>

<!-- Produits liés (remplacements / alternatives) -->
{#if product.related.length > 0}
	<section class="mt-8">
		<h2 class="mb-4 text-xl font-bold text-gray-900 uppercase">
			Produits <span class="text-shop-orange">liés</span>
		</h2>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each product.related as related (related.id)}
				<ProductCard product={related} />
			{/each}
		</div>
	</section>
{/if}

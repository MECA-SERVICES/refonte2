<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import {
		CartPlusSolid,
		FileLinesOutline,
		PhoneSolid,
		TruckOutline,
		ShieldCheckSolid
	} from 'flowbite-svelte-icons';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import { formatPrice } from '$lib/shop';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const product = $derived(data.product);
	const images = $derived(product.media.filter((m) => m.type === 'image'));
	/** Vues éclatées et notices : documents techniques attachés à la fiche. */
	const documents = $derived(product.media.filter((m) => m.type === 'pdf'));

	/** Image affichée en grand ; l'index repart à zéro quand la fiche change. */
	let selected = $state<{ id: number; index: number } | null>(null);
	const activeIndex = $derived.by(() => {
		const current = selected;
		return current && current.id === product.id ? current.index : 0;
	});

	const saved = $derived(
		product.priceTtcStrike ? Number(product.priceTtcStrike) - Number(product.priceTtc) : 0
	);

	const crumbs = $derived([
		...product.breadcrumb.map((c) => ({ label: c.name, href: `/categorie/${c.slug}` })),
		{ label: product.name }
	]);
</script>

<svelte:head>
	<title>{product.metaTitle ?? `${product.name} — MS Shop`}</title>
	<meta
		name="description"
		content={product.metaDescription ??
			product.shortDescription ??
			`${product.name} — référence ${product.reference}, disponible chez MS Shop.`}
	/>
</svelte:head>

<Breadcrumb items={crumbs} />

<div class="grid gap-8 lg:grid-cols-2 lg:gap-12">
	<!-- ================= Galerie ================= -->
	<div>
		<div class="overflow-hidden rounded-2xl border border-shop-border bg-white p-4">
			{#if images.length > 0}
				<img
					src={images[activeIndex]?.url}
					alt={images[activeIndex]?.alt ?? product.name}
					class="aspect-square w-full object-contain"
				/>
			{:else}
				<ImagePlaceholder label="Photo produit" class="aspect-square border-0" />
			{/if}
		</div>

		{#if images.length > 1}
			<div class="mt-3 grid grid-cols-5 gap-3">
				{#each images as media, i (media.id)}
					<button
						type="button"
						onclick={() => (selected = { id: product.id, index: i })}
						aria-label="Voir l'image {i + 1}"
						aria-current={i === activeIndex}
						class="overflow-hidden rounded-xl border bg-white p-1.5 transition-colors {i ===
						activeIndex
							? 'border-shop-blue'
							: 'border-shop-border hover:border-shop-blue/50'}"
					>
						<img
							src={media.url}
							alt={media.alt ?? ''}
							loading="lazy"
							class="aspect-square w-full object-contain"
						/>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ================= Informations & achat ================= -->
	<div>
		{#if product.brandName}
			<a
				href="/recherche?q={encodeURIComponent(product.brandName)}"
				class="text-sm font-semibold tracking-wide text-shop-muted uppercase hover:text-shop-blue"
			>
				{product.brandName}
			</a>
		{/if}

		<h1 class="mt-1 text-2xl font-extrabold tracking-tight text-shop-ink sm:text-3xl">
			{product.name}
		</h1>

		<dl class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-shop-muted">
			<div class="flex gap-1.5">
				<dt>Référence</dt>
				<dd class="font-semibold text-shop-ink">{product.reference}</dd>
			</div>
			{#if product.supplierReference}
				<div class="flex gap-1.5">
					<dt>Réf. fournisseur</dt>
					<dd class="font-semibold text-shop-ink">{product.supplierReference}</dd>
				</div>
			{/if}
		</dl>

		{#if product.shortDescription}
			<div class="mt-5 text-sm leading-6 text-shop-muted">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
				{@html product.shortDescription}
			</div>
		{/if}

		<!-- Bloc prix : le rouge est le signal d'achat de la charte -->
		<div class="mt-6 rounded-2xl bg-shop-subtle p-5">
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span class="text-3xl font-extrabold text-shop-red">{formatPrice(product.priceTtc)}</span>
				<span class="text-sm font-medium text-shop-muted">TTC</span>
				{#if product.priceTtcStrike}
					<span class="text-base text-shop-muted line-through">
						{formatPrice(product.priceTtcStrike)}
					</span>
				{/if}
				{#if saved > 0}
					<span
						class="rounded-lg bg-shop-orange px-2.5 py-1 text-xs font-bold tracking-wide text-white uppercase"
					>
						Économisez {formatPrice(saved)}
					</span>
				{/if}
			</div>
			<p class="mt-1 text-sm text-shop-muted">
				soit {formatPrice(product.priceHt)} HT
				{#if product.taxRate}
					· TVA {product.taxRate} %
				{/if}
			</p>

			<p class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-shop-ink">
				<span
					class="h-2.5 w-2.5 rounded-full {product.stock > 0 ? 'bg-green-500' : 'bg-shop-orange'}"
					aria-hidden="true"
				></span>
				{product.stock > 0 ? 'En stock, expédié sous 24-48 h' : 'Sur commande — nous consulter'}
			</p>

			<div class="mt-5 flex flex-wrap gap-3">
				<Button size="lg" disabled class="grow sm:grow-0">
					<CartPlusSolid class="me-2 h-5 w-5" /> Ajouter au panier
				</Button>
				<Button size="lg" color="alternative" href="tel:0950922336">
					<PhoneSolid class="me-2 h-4 w-4" /> Un conseil ?
				</Button>
			</div>
			<p class="mt-2 text-xs text-shop-muted">Le panier sera disponible prochainement.</p>
		</div>

		<!-- Réassurance : reprise des engagements affichés en en-tête -->
		<ul class="mt-6 grid gap-3 text-sm text-shop-muted sm:grid-cols-3">
			<li class="flex items-center gap-2">
				<TruckOutline class="h-5 w-5 shrink-0 text-shop-blue" /> Expédition rapide
			</li>
			<li class="flex items-center gap-2">
				<ShieldCheckSolid class="h-5 w-5 shrink-0 text-shop-blue" /> Pièces d'origine
			</li>
			<li class="flex items-center gap-2">
				<PhoneSolid class="h-5 w-5 shrink-0 text-shop-blue" /> S.A.V toutes marques
			</li>
		</ul>

		{#if documents.length > 0}
			<div class="mt-6">
				<h2 class="text-sm font-bold tracking-wide text-shop-ink uppercase">
					Documents techniques
				</h2>
				<ul class="mt-2 space-y-1.5">
					{#each documents as doc (doc.id)}
						<li>
							<a
								href={doc.url}
								target="_blank"
								rel="noopener"
								class="inline-flex items-center gap-2 text-sm font-medium text-shop-blue hover:underline"
							>
								<FileLinesOutline class="h-4 w-4" />
								{doc.alt ?? 'Vue éclatée / notice (PDF)'}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</div>

{#if product.variants.length > 0}
	<section class="mt-12">
		<h2 class="text-xl font-extrabold tracking-wide text-shop-ink uppercase">Déclinaisons</h2>
		<ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each product.variants as variant (variant.id)}
				<li class="rounded-xl border border-shop-border bg-white p-4">
					<p class="font-semibold text-shop-ink">{variant.name}</p>
					{#if variant.reference}
						<p class="mt-0.5 text-xs text-shop-muted">Réf. {variant.reference}</p>
					{/if}
					<p class="mt-2 text-sm text-shop-muted">
						{variant.stock > 0 ? 'En stock' : 'Sur commande'}
					</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if product.description}
	<section class="mt-12 border-t border-shop-border pt-8">
		<h2 class="text-xl font-extrabold tracking-wide text-shop-ink uppercase">Description</h2>
		<div class="mt-4 max-w-4xl text-sm leading-6 text-shop-muted">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
			{@html product.description}
		</div>
	</section>
{/if}

{#if product.related.length > 0}
	<section class="mt-12 border-t border-shop-border pt-8">
		<h2 class="text-xl font-extrabold tracking-wide text-shop-ink uppercase">Vous aimerez aussi</h2>
		<div class="mt-5 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
			{#each product.related as item (item.id)}
				<ProductCard product={item} />
			{/each}
		</div>
	</section>
{/if}

<script lang="ts">
	import { formatNumber } from '$lib/money';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const brand = $derived(data.brand);

	/**
	 * Chiffres du bandeau.
	 *
	 * Ils viennent du catalogue réel plutôt que d'une saisie : un compteur faux
	 * se remarque tout de suite sur une page de marque.
	 */
	const facts = $derived([
		{ value: formatNumber(data.facts.products), label: 'références en ligne' },
		{ value: formatNumber(data.facts.inStock), label: 'en stock atelier' },
		{ value: formatNumber(data.facts.categories), label: 'rayons couverts' },
		{ value: '24 h', label: 'expédition des pièces' }
	]);
</script>

<svelte:head>
	<title>{brand.metaTitle ?? `${brand.name} — MS Shop`}</title>
	{#if brand.metaDescription ?? brand.tagline}
		<meta name="description" content={brand.metaDescription ?? brand.tagline} />
	{/if}
</svelte:head>

<!-- ================= Bandeau ================= -->
<!--
	Le visuel occupe toute la largeur, l'encart d'identité posé en bas à gauche :
	il reste lisible quelle que soit la photo, contrairement à un titre centré.
-->
<section class="relative -mx-4 mt-4 mb-10 bg-shop-blue sm:-mx-6 lg:-mx-8">
	{#if brand.heroImageUrl}
		<img src={brand.heroImageUrl} alt="" class="h-[300px] w-full object-cover" />
	{:else}
		<ImagePlaceholder label="Visuel de marque" class="h-[300px] border-0" />
	{/if}

	<div class="pointer-events-none absolute inset-0 flex items-end">
		<div class="mx-auto w-full max-w-[1360px] px-4 pb-6 sm:px-6 lg:px-8">
			<div class="bg-shop-surface inline-block px-4.5 py-3.5">
				<div class="flex flex-wrap items-center gap-3">
					{#if brand.logoUrl}
						<img src={brand.logoUrl} alt="" class="h-9 w-auto max-w-28 object-contain" />
					{/if}
					<h1
						class="font-display text-[24px] font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[34px]"
					>
						{brand.name} chez MS Shop
					</h1>
				</div>
				{#if brand.tagline}
					<p class="mt-1 text-sm text-shop-muted">{brand.tagline}</p>
				{/if}
			</div>
		</div>
	</div>
</section>

<!-- ================= Présentation & chiffres ================= -->
<div class="mb-11 grid gap-8 lg:grid-cols-2 lg:items-start">
	<div>
		{#if brand.pageContent}
			<!-- Même classe que l'éditeur : le rédacteur voit ce qui sera publié. -->
			<div class="format max-w-none format-blue">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
				{@html brand.pageContent}
			</div>
		{:else}
			<p class="max-w-[64ch] text-base leading-relaxed text-shop-ink-soft">
				Retrouvez l'ensemble des pièces et matériels {brand.name} disponibles chez MS Shop. Nos références
				sont commandées sur numéro constructeur et expédiées depuis notre atelier de Carantilly.
			</p>
		{/if}
	</div>

	<div class="grid gap-2.5 sm:grid-cols-2">
		{#each facts as fact (fact.label)}
			<div class="border-[1.5px] border-shop-border bg-white p-4.5">
				<p class="font-display text-[22px] font-extrabold tracking-[-0.02em] text-shop-ink">
					{fact.value}
				</p>
				<p class="mt-1 text-[13px] text-shop-muted">{fact.label}</p>
			</div>
		{/each}
	</div>
</div>

<!-- ================= Sélecteur de pièce ================= -->
<section
	class="mb-11 grid gap-6 border-[1.5px] border-shop-ink bg-shop-border-soft p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
>
	<div>
		<p class="font-display text-[24px] font-extrabold tracking-[-0.02em] text-shop-ink">
			Vos pièces {brand.name}, par modèle
		</p>
		<p class="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-shop-ink-soft">
			Sélectionnez votre machine : vue éclatée, référence d'origine et stock atelier sur la même
			page.
		</p>
	</div>
	<ShopButton variant="primary" size="lg" href="/vue-eclatee">
		Ouvrir le sélecteur de pièce
	</ShopButton>
</section>

<!-- ================= Gammes ================= -->
{#if data.ranges.length > 0}
	<h2 class="mb-4 font-display text-[26px] font-extrabold tracking-[-0.02em] text-shop-ink">
		<span class="text-shop-orange">Gammes</span>
	</h2>

	<div class="mb-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.ranges as range (range.id)}
			<a
				href="/categorie/{range.slug}?marque={brand.slug}"
				class="block border-[1.5px] border-shop-border bg-white p-4 transition-colors hover:border-shop-ink"
			>
				<p class="font-display text-base font-bold text-shop-ink">{range.name}</p>
				<p class="mt-1 text-[13px] text-shop-muted">
					{formatNumber(range.total)} référence{range.total > 1 ? 's' : ''}
				</p>
			</a>
		{/each}
	</div>
{/if}

<!-- ================= Aperçu du catalogue ================= -->
{#if data.products.length > 0}
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
		<h2 class="font-display text-[26px] font-extrabold tracking-[-0.02em] text-shop-ink">
			Au catalogue
		</h2>
		<a
			href="/recherche?marque={brand.slug}"
			class="font-display text-sm font-bold text-shop-blue hover:underline"
		>
			Voir les {formatNumber(data.facts.products)} références →
		</a>
	</div>

	<div class="mb-11 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
		{#each data.products as item (item.id)}
			<ProductCard product={item} />
		{/each}
	</div>
{/if}

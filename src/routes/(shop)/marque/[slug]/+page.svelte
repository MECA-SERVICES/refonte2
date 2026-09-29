<script lang="ts">
	import { formatNumber } from '$lib/money';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
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

	/** Autres marques du bandeau final — la marque courante n'y figure pas. */
	const otherBrands = $derived(data.topBrands.filter((b) => b.slug !== brand.slug).slice(0, 12));

	const checks = [
		'Pièces commandées sur numéro constructeur',
		"Pièces d'usure en stock permanent",
		'Machines livrées montées et contrôlées',
		'Tarifs pro et mandat administratif'
	];
</script>

<svelte:head>
	<title>{brand.metaTitle ?? `${brand.name} — MS Shop`}</title>
	{#if brand.metaDescription ?? brand.tagline}
		<meta name="description" content={brand.metaDescription ?? brand.tagline} />
	{/if}
</svelte:head>

<Breadcrumb items={[{ label: 'Nos marques', href: '/marques' }, { label: brand.name }]} />

<!-- ================= Héro ================= -->
<!--
	Même disposition que le hero de l'accueil : le visuel sort du conteneur et
	couvre toute la largeur de l'écran, sous un dégradé gauche→droite. Sans
	photo de présentation, le logo de la marque tient le rôle du visuel.
-->
<div class="relative right-1/2 left-1/2 -mx-[50vw] w-screen">
	<section class="relative h-[480px] overflow-hidden bg-shop-ink sm:h-[560px]">
		{#if brand.heroImageUrl}
			<img src={brand.heroImageUrl} alt="" class="h-full w-full object-cover" />
		{:else if brand.logoUrl}
			<!-- Le logo occupe la moitié droite, laissée libre par le texte. -->
			<div class="flex h-full items-center justify-center p-8 lg:justify-end lg:pr-[12vw]">
				<span
					class="flex max-h-[45%] max-w-[70%] items-center justify-center rounded-2xl bg-white p-8 lg:max-w-[38%]"
				>
					<img src={brand.logoUrl} alt="" class="max-h-full max-w-full object-contain" />
				</span>
			</div>
		{:else}
			<ImagePlaceholder
				label="Visuel de marque {brand.name}"
				class="border-0 bg-shop-ink text-shop-on-dark"
			/>
		{/if}

		<div
			class="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(20,26,58,0.9)] via-[rgba(20,26,58,0.55)] via-50% to-[rgba(20,26,58,0.05)]"
		></div>

		<!-- Le texte s'aligne sur le conteneur du site, comme sur l'accueil. -->
		<div class="absolute inset-0">
			<div class="mx-auto flex h-full w-full max-w-[1440px] items-center px-4 sm:px-6">
				<div class="flex max-w-[640px] flex-col gap-3.5 text-white">
					<div class="flex flex-wrap items-center gap-3.5">
						{#if brand.logoUrl && brand.heroImageUrl}
							<span class="flex h-[72px] w-40 items-center justify-center rounded-xl bg-white p-2">
								<img src={brand.logoUrl} alt="" class="max-h-full max-w-full object-contain" />
							</span>
						{/if}
						<span
							class="rounded-full border-[1.5px] border-white/35 bg-white/15 px-3 py-1.5 font-display text-xs font-bold tracking-[0.1em] uppercase"
						>
							Revendeur agréé · S.A.V atelier
						</span>
					</div>
					<h1
						class="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-balance sm:text-[40px] lg:text-[48px]"
					>
						{brand.name} chez MECA SERVICES
					</h1>
					{#if brand.tagline}
						<p class="max-w-[50ch] text-[16.5px] leading-normal text-pretty text-[#e2e7f6]">
							{brand.tagline}
						</p>
					{/if}
					<div class="mt-1 flex flex-wrap gap-2.5">
						<a
							href="#gammes"
							class="rounded-[10px] bg-white px-5 py-3 font-display text-[15px] font-bold text-shop-ink transition-colors hover:bg-primary-100"
						>
							Voir les gammes
						</a>
						<a
							href="/recherche?marque={brand.slug}"
							class="rounded-[10px] bg-shop-orange px-5 py-3 font-display text-[15px] font-bold text-white transition-colors hover:bg-shop-orange-deep"
						>
							Pièces détachées {brand.name}
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

<!-- ================= Chiffres ================= -->
<!-- Le bandeau chevauche le héro : les compteurs répondent tout de suite à la
     question « qu'est-ce que vous avez vraiment en {brand.name} ? ». -->
<div
	class="relative z-10 -mt-10 grid gap-px overflow-hidden rounded-2xl bg-shop-border-soft shadow-[0_20px_50px_rgba(30,36,54,0.14),0_2px_6px_rgba(30,36,54,0.06)] sm:mx-8 sm:grid-cols-2 lg:grid-cols-4"
>
	{#each facts as fact (fact.label)}
		<div class="bg-white px-5 py-5">
			<p
				class="font-display text-[28px] leading-none font-extrabold tracking-[-0.025em] text-shop-blue"
			>
				{fact.value}
			</p>
			<p class="mt-1.5 text-[13.5px] text-shop-muted">{fact.label}</p>
		</div>
	{/each}
</div>

<!-- ================= Sélecteur de pièce ================= -->
<section class="mt-12 grid items-center gap-6 rounded-2xl bg-shop-subtle p-7 sm:p-8 lg:grid-cols-2">
	<div>
		<p
			class="mb-2.5 inline-flex items-center gap-2 font-display text-xs font-extrabold tracking-[0.12em] text-shop-blue uppercase"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d="M14.7 6.3a4 4 0 0 0 5 5L13 18a3 3 0 0 1-4.2 0L4 13.2a3 3 0 0 1 0-4.2L10.7 2.3a4 4 0 0 0 4 4z"
				/>
			</svg>
			Pièces détachées
		</p>
		<h2
			class="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[28px]"
		>
			Vos pièces {brand.name}, par modèle
		</h2>
		<p class="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-pretty text-shop-ink-soft">
			Sélectionnez votre machine : vue éclatée, référence d'origine et stock atelier sur la même
			page. Le numéro de modèle se trouve sur la plaque constructeur, près du moteur.
		</p>
	</div>
	<div class="flex flex-col gap-2.5 sm:flex-row lg:justify-end">
		<a
			href="/vue-eclatee"
			class="rounded-[10px] bg-shop-blue px-5 py-3.5 text-center font-display text-[15px] font-bold text-white transition-colors hover:bg-shop-blue-dark"
		>
			Ouvrir le sélecteur de pièce
		</a>
		<a
			href="https://doc.mecaservicesshop.fr"
			target="_blank"
			rel="noopener"
			class="rounded-[10px] border-[1.5px] border-shop-border bg-white px-5 py-3.5 text-center font-display text-[15px] font-bold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
		>
			Parcourir les vues éclatées
		</a>
	</div>
</section>

<!-- ================= Gammes ================= -->
{#if data.ranges.length > 0}
	<section id="gammes" class="mt-12 scroll-mt-24">
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
			<h2
				class="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[28px] lg:text-[32px]"
			>
				Les gammes <span class="text-shop-blue">{brand.name}</span>
			</h2>
			<span class="text-sm text-shop-muted">Machines neuves, livrées montées et contrôlées</span>
		</div>

		<div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.ranges as range (range.id)}
				<a
					href="/categorie/{range.slug}?marque={brand.slug}"
					class="block overflow-hidden rounded-[14px] border-[1.5px] border-shop-border-soft bg-white transition-[border-color,box-shadow] hover:border-shop-blue hover:shadow-[0_10px_30px_rgba(30,36,54,0.08)]"
				>
					{#if range.imageUrl}
						<!-- La gamme est illustrée par la photo d'un de ses produits. -->
						<img
							src={range.imageUrl}
							alt=""
							loading="lazy"
							class="h-[150px] w-full border-b border-shop-border-soft object-cover"
						/>
					{:else}
						<ImagePlaceholder label={range.name} class="h-[150px] border-0 border-b" />
					{/if}
					<span class="flex items-start justify-between gap-2.5 px-4 pt-3.5 pb-4">
						<span>
							<span class="block font-display text-base font-bold text-shop-ink">
								{range.name}
							</span>
							<span class="mt-0.5 block text-[13px] text-shop-muted">
								{formatNumber(range.total)} référence{range.total > 1 ? 's' : ''}
							</span>
						</span>
						<span class="font-display font-extrabold text-shop-blue" aria-hidden="true">→</span>
					</span>
				</a>
			{/each}
		</div>
	</section>
{/if}

<!-- ================= Aperçu du catalogue ================= -->
{#if data.products.length > 0}
	<section class="mt-12">
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
			<h2
				class="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[28px] lg:text-[32px]"
			>
				Au catalogue
			</h2>
			<a
				href="/recherche?marque={brand.slug}"
				class="font-display text-sm font-bold text-shop-blue hover:underline"
			>
				Voir les {formatNumber(data.facts.products)} références →
			</a>
		</div>

		<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
			{#each data.products as item (item.id)}
				<ProductCard product={item} />
			{/each}
		</div>

		<div class="mt-5 text-center">
			<a
				href="/recherche?marque={brand.slug}"
				class="inline-block rounded-[10px] border-[1.5px] border-shop-border px-5 py-3 font-display text-sm font-bold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
			>
				Voir les {formatNumber(data.facts.products)} références {brand.name} →
			</a>
		</div>
	</section>
{/if}

<!-- ================= Pourquoi chez nous ================= -->
<section class="mt-12 grid items-center gap-8 lg:grid-cols-2">
	<div>
		<h2
			class="mb-3 font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[28px]"
		>
			Pourquoi acheter {brand.name} chez nous
		</h2>
		{#if brand.pageContent}
			<!-- Même classe que l'éditeur : le rédacteur voit ce qui sera publié. -->
			<div class="format max-w-none format-blue">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
				{@html brand.pageContent}
			</div>
		{:else}
			<p class="mb-3 max-w-[64ch] text-[15.5px] leading-relaxed text-pretty text-shop-ink-soft">
				Nous préparons chaque machine avant expédition : montage, contrôle et enregistrement de la
				garantie. Le S.A.V se fait à Carantilly, pas à l'usine.
			</p>
			<p class="max-w-[64ch] text-[15.5px] leading-relaxed text-pretty text-shop-ink-soft">
				Côté pièces, nous commandons sur numéro constructeur à partir des vues éclatées officielles
				— la référence exacte de votre modèle, y compris pour les machines anciennes.
			</p>
		{/if}
		<ul class="mt-5 grid gap-x-5 gap-y-2 text-sm text-shop-ink-soft sm:grid-cols-2">
			{#each checks as check (check)}
				<li class="flex gap-2">
					<span class="font-extrabold text-shop-green" aria-hidden="true">✓</span>
					{check}
				</li>
			{/each}
		</ul>
	</div>
	<ImagePlaceholder
		label="Atelier Meca Services — machines {brand.name} en préparation"
		class="h-[340px] rounded-2xl"
	/>
</section>

<!-- ================= Autres marques ================= -->
{#if otherBrands.length > 0}
	<section class="mt-12 mb-4">
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
			<h2
				class="font-display text-[22px] leading-tight font-extrabold tracking-[-0.015em] text-shop-ink"
			>
				Nos autres marques
			</h2>
			<a href="/marques" class="font-display text-sm font-bold text-shop-blue hover:underline">
				Toutes nos marques →
			</a>
		</div>
		<div class="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
			{#each otherBrands as other (other.id)}
				<a
					href="/marque/{other.slug}"
					class="flex h-[68px] items-center justify-center rounded-xl border-[1.5px] border-shop-border-soft bg-white px-2.5 text-center font-display text-sm font-extrabold tracking-[0.02em] text-shop-ink-soft uppercase transition-colors hover:border-shop-blue hover:text-shop-blue"
				>
					{#if other.logoUrl}
						<img
							src={other.logoUrl}
							alt={other.name}
							loading="lazy"
							class="max-h-[80%] max-w-full object-contain"
						/>
					{:else}
						{other.name}
					{/if}
				</a>
			{/each}
		</div>
	</section>
{/if}

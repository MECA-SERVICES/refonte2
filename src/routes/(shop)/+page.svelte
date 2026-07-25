<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Button, Card } from 'flowbite-svelte';
	import {
		ArrowRightOutline,
		BatteryOutline,
		BadgeCheckOutline,
		CogOutline,
		FireOutline,
		GridOutline,
		LayersOutline,
		LockSolid,
		PhoneSolid,
		ShieldCheckSolid,
		SunOutline,
		TagOutline,
		ToolsOutline,
		TruckOutline,
		UserHeadsetOutline
	} from 'flowbite-svelte-icons';
	import type { Component } from 'svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const fmt = new Intl.NumberFormat('fr-FR');
	/** « 1,3 million » — chiffre arrondi pour le bandeau. */
	const totalMillions = $derived((data.productTotal / 1_000_000).toFixed(1).replace('.', ','));

	/** Icônes attribuées aux rayons par rotation (pas d'images de catégories pour l'instant). */
	const categoryIcons: Component[] = [
		ToolsOutline,
		CogOutline,
		TagOutline,
		BatteryOutline,
		SunOutline,
		GridOutline,
		LayersOutline,
		FireOutline
	];

	/** Lien direct vers le déstockage s'il existe dans le menu, sinon le catalogue. */
	const clearance = $derived(data.menu.find((entry) => entry.slug.includes('destockage')));
	const clearanceHref = $derived(
		clearance
			? resolve('/(shop)/categorie/[slug]', { slug: clearance.slug })
			: resolve('/(shop)/recherche')
	);

	const usps = [
		{ icon: TruckOutline, title: 'Expédition rapide', text: 'Partout en France métropolitaine' },
		{
			icon: ShieldCheckSolid,
			title: 'Pièces 100 % origine',
			text: 'Toutes nos pièces sont de marque'
		},
		{ icon: ToolsOutline, title: 'S.A.V toutes marques', text: 'Atelier et experts motoculture' },
		{ icon: LockSolid, title: 'Paiement sécurisé', text: 'CB, 3 ou 4 fois, mandat Chorus' }
	];
</script>

<svelte:head>
	<title>MS Shop — Meca Services · Motoculture & pièces détachées</title>
	<meta
		name="description"
		content="Pièces détachées et matériel de motoculture : plus de {fmt.format(
			data.productTotal
		)} références de marque, 100 % origine. Tondeuses, robots, débroussailleuses, S.A.V expert."
	/>
</svelte:head>

<!-- ============================ Hero ============================ -->
<section
	class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-shop-blue via-shop-blue to-shop-blue-dark px-6 py-14 text-white sm:px-12 lg:py-20"
>
	<!-- Décor -->
	<div
		class="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-shop-blue-light/40 blur-3xl"
	></div>
	<div
		class="pointer-events-none absolute right-40 -bottom-32 h-64 w-64 rounded-full bg-shop-orange/20 blur-3xl"
	></div>

	<div class="relative max-w-3xl">
		<Badge rounded class="mb-4 bg-white/10 px-3 py-1 text-sm font-medium text-white">
			<BadgeCheckOutline class="me-1.5 h-4 w-4 text-shop-orange" />
			30 ans d'expérience en motoculture
		</Badge>
		<h1 class="text-4xl leading-tight font-black tracking-tight sm:text-5xl">
			La bonne pièce,<br />
			<span class="text-shop-orange">du premier coup.</span>
		</h1>
		<p class="mt-4 max-w-xl text-lg text-blue-100">
			Plus de <strong class="text-white">{totalMillions} million</strong> de pièces détachées et matériels
			de motoculture — tondeuses, robots, débroussailleuses, motoculteurs — 100&nbsp;% origine.
		</p>
		<div class="mt-8 flex flex-wrap gap-3">
			<Button
				size="lg"
				href={resolve('/(shop)/recherche')}
				class="bg-shop-orange font-semibold focus-within:ring-shop-orange-light hover:bg-shop-orange-light"
			>
				Découvrir le catalogue <ArrowRightOutline class="ms-2 h-5 w-5" />
			</Button>
			<Button
				size="lg"
				color="alternative"
				href="tel:0950922336"
				class="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
			>
				<PhoneSolid class="me-2 h-4 w-4" /> 09 50 92 23 36
			</Button>
		</div>
	</div>
</section>

<!-- ============================ Réassurance ============================ -->
<section class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Nos garanties">
	{#each usps as usp (usp.title)}
		{@const Icon = usp.icon}
		<div class="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
			<span class="rounded-lg bg-shop-blue/10 p-2.5">
				<Icon class="h-6 w-6 text-shop-blue" />
			</span>
			<div>
				<p class="text-sm font-semibold text-gray-900">{usp.title}</p>
				<p class="mt-0.5 text-xs text-gray-500">{usp.text}</p>
			</div>
		</div>
	{/each}
</section>

<!-- ============================ Rayons ============================ -->
{#if data.menu.length > 0}
	<section class="mt-12">
		<div class="mb-5 flex items-end justify-between">
			<div>
				<h2 class="text-2xl font-black text-gray-900">Nos rayons</h2>
				<p class="mt-1 text-sm text-gray-500">Trouvez votre matériel ou vos pièces par univers</p>
			</div>
			<a
				href={resolve('/(shop)/recherche')}
				class="hidden items-center gap-1 text-sm font-semibold text-shop-blue hover:underline sm:flex"
			>
				Tout le catalogue <ArrowRightOutline class="h-4 w-4" />
			</a>
		</div>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
			{#each data.menu as entry, i (entry.id)}
				{@const Icon = categoryIcons[i % categoryIcons.length]}
				<a
					href={resolve('/(shop)/categorie/[slug]', { slug: entry.slug })}
					class="group rounded-xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-shop-blue hover:shadow-md"
				>
					<span
						class="inline-flex rounded-lg bg-shop-blue/10 p-2.5 transition group-hover:bg-shop-blue"
					>
						<Icon class="h-6 w-6 text-shop-blue transition group-hover:text-white" />
					</span>
					<h3 class="mt-3 text-sm font-bold text-gray-900 group-hover:text-shop-blue">
						{entry.name}
					</h3>
					<p class="mt-1 text-xs text-gray-500">
						{entry.children.length > 0
							? `${entry.children.length} sous-catégorie${entry.children.length > 1 ? 's' : ''}`
							: 'Voir le rayon'}
					</p>
				</a>
			{/each}
		</div>
	</section>
{/if}

<!-- ============================ Nouveaux produits ============================ -->
<section class="mt-12">
	<div class="mb-5 flex items-end justify-between">
		<div>
			<h2 class="text-2xl font-black text-gray-900">Nouveaux produits</h2>
			<p class="mt-1 text-sm text-gray-500">Les dernières références ajoutées au catalogue</p>
		</div>
		<a
			href={resolve('/(shop)/recherche')}
			class="hidden items-center gap-1 text-sm font-semibold text-shop-blue hover:underline sm:flex"
		>
			Voir tout <ArrowRightOutline class="h-4 w-4" />
		</a>
	</div>
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
		{#each data.latest as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>
</section>

<!-- ============================ Bandeaux promo ============================ -->
<section class="mt-12 grid gap-4 lg:grid-cols-2">
	<Card
		href={clearanceHref}
		class="max-w-none justify-between overflow-hidden border-0 bg-gradient-to-br from-shop-orange to-shop-orange-light p-8 text-white hover:shadow-lg"
	>
		<div>
			<TagOutline class="h-8 w-8 text-white/80" />
			<h3 class="mt-3 text-2xl font-black">Déstockage & promotions</h3>
			<p class="mt-2 text-sm text-orange-50">
				Matériels et pièces à prix réduits, dans la limite des stocks disponibles.
			</p>
		</div>
		<span class="mt-6 inline-flex items-center gap-1 text-sm font-bold">
			J'en profite <ArrowRightOutline class="h-4 w-4" />
		</span>
	</Card>
	<Card
		href="tel:0950922336"
		class="max-w-none justify-between overflow-hidden border-0 bg-gradient-to-br from-shop-blue to-shop-blue-dark p-8 text-white hover:shadow-lg"
	>
		<div>
			<UserHeadsetOutline class="h-8 w-8 text-white/80" />
			<h3 class="mt-3 text-2xl font-black">Besoin d'aide pour trouver une pièce ?</h3>
			<p class="mt-2 text-sm text-blue-100">
				Vues éclatées, références constructeur : nos experts vous guident au
				<strong class="text-white">09 50 92 23 36</strong> — 9h/12h · 14h/18h.
			</p>
		</div>
		<span class="mt-6 inline-flex items-center gap-1 text-sm font-bold">
			Nous appeler <ArrowRightOutline class="h-4 w-4" />
		</span>
	</Card>
</section>

<!-- ============================ Marques ============================ -->
{#if data.brands.length > 0}
	<section class="mt-12">
		<div class="mb-5">
			<h2 class="text-2xl font-black text-gray-900">Nos marques partenaires</h2>
			<p class="mt-1 text-sm text-gray-500">
				Plus de 1&nbsp;000 marques distribuées — pièces et matériels d'origine
			</p>
		</div>
		<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
			{#each data.brands as brandItem (brandItem.id)}
				<div
					class="flex h-20 items-center justify-center rounded-xl border border-gray-200 bg-white p-3"
				>
					{#if brandItem.logoUrl}
						<img
							src={brandItem.logoUrl}
							alt={brandItem.name}
							loading="lazy"
							class="max-h-full max-w-full object-contain"
						/>
					{:else}
						<span class="text-center text-sm font-bold tracking-wide text-gray-600 uppercase">
							{brandItem.name}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/if}

<!-- ============================ Chiffres clés ============================ -->
<section
	class="mt-12 mb-2 grid gap-6 rounded-2xl bg-white px-6 py-10 text-center shadow-sm sm:grid-cols-3"
	aria-label="MS Shop en chiffres"
>
	<div>
		<p class="text-3xl font-black text-shop-blue">{fmt.format(data.productTotal)}</p>
		<p class="mt-1 text-sm tracking-wide text-gray-500 uppercase">Références produits</p>
	</div>
	<div>
		<p class="text-3xl font-black text-shop-blue">30 ans</p>
		<p class="mt-1 text-sm tracking-wide text-gray-500 uppercase">D'expérience terrain</p>
	</div>
	<div>
		<p class="text-3xl font-black text-shop-blue">1&nbsp;000+</p>
		<p class="mt-1 text-sm tracking-wide text-gray-500 uppercase">Marques distribuées</p>
	</div>
</section>

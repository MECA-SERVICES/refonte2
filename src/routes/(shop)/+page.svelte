<script lang="ts">
	import { Button, Input } from 'flowbite-svelte';
	import {
		ArrowRightOutline,
		BatteryOutline,
		CogOutline,
		EnvelopeOutline,
		FireOutline,
		GridOutline,
		LayersOutline,
		PhoneSolid,
		SunOutline,
		TagOutline,
		ToolsOutline,
		UserHeadsetOutline
	} from 'flowbite-svelte-icons';
	import type { Component } from 'svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import HomeSlider from '$lib/components/shop/HomeSlider.svelte';
	import type { Slide } from '$lib/components/shop/hero-slider';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const fmt = new Intl.NumberFormat('fr-FR');
	/** « 1,3 million » — chiffre arrondi pour les bandeaux. */
	const totalMillions = $derived((data.productTotal / 1_000_000).toFixed(1).replace('.', ','));

	/** Icônes attribuées aux rayons par rotation (pas d'images de catégories). */
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
	const clearanceHref = $derived(clearance ? `/categorie/${clearance.slug}` : '/recherche');

	const slides: Slide[] = [
		{
			href: '/recherche',
			image: '/slider/iseki-sa250-remise.jpg',
			imageLabel:
				'Motobineuse ISEKI SA250 en stock : remise de 309 €, 1 540 € TTC au lieu de 1 849 € TTC'
		},
		{
			href: '/recherche',
			image: '/slider/iseki-sra-950fa-promotion.jpg',
			imageLabel:
				'Tondeuse autoportée ISEKI SRA 950FA en promotion : 11 999 € TTC au lieu de 15 226,80 €'
		},
		{
			href: '/recherche',
			image: '/slider/robots-tondeuses-bientot-disponible.jpg',
			imageLabel:
				'Robots tondeuses bientôt disponibles : LIDAR, 4x4, NRTK, jusqu’à 24 000 m² de tonte'
		}
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

<!-- ================= Carrousel d'accueil ================= -->
<HomeSlider {slides} />

<!-- ================= Bento promotions ================= -->
<!-- Grille d'emplacements promotionnels : une grande vitrine et trois tuiles. -->
<section
	class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[200px] lg:grid-cols-4"
	aria-label="Promotions en cours"
>
	<!-- Grande vitrine promotionnelle -->
	<a
		href={clearanceHref}
		class="group flex flex-col overflow-hidden rounded-2xl border border-shop-border bg-white sm:col-span-2 lg:row-span-2"
	>
		<div class="min-h-[220px] flex-1 overflow-hidden p-3 pb-0">
			<img
				src="/promo/ego-tondeuse-sans-fil.png"
				alt="Tonte avec une tondeuse sans fil EGO Power+ 56V"
				loading="lazy"
				class="h-full w-full rounded-xl object-cover"
			/>
		</div>
		<div class="flex items-center justify-between gap-4 p-5">
			<div>
				<p class="text-xs font-semibold tracking-wide text-shop-orange uppercase">Promo à la une</p>
				<h2 class="mt-1 text-lg font-bold text-shop-ink">Votre offre du moment</h2>
			</div>
			<ArrowRightOutline
				class="h-5 w-5 shrink-0 text-shop-muted transition-transform group-hover:translate-x-1 group-hover:text-shop-blue"
			/>
		</div>
	</a>

	<!-- Déstockage : l'orange est le signal commercial de la charte -->
	<a
		href={clearanceHref}
		class="group flex flex-col justify-between rounded-2xl bg-shop-orange-deep p-6 text-white transition-colors hover:bg-shop-orange sm:col-span-2 lg:col-span-2"
	>
		<div>
			<TagOutline class="h-7 w-7 text-white/80" />
			<h2 class="mt-2 text-xl font-bold">Déstockage & promotions</h2>
			<p class="mt-1 text-sm text-white/85">
				Matériels et pièces à prix réduits, dans la limite des stocks.
			</p>
		</div>
		<span class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
			J'en profite
			<ArrowRightOutline class="h-4 w-4 transition-transform group-hover:translate-x-1" />
		</span>
	</a>

	<!-- Emplacement promo secondaire : tuile sombre, accent orange -->
	<a
		href={clearanceHref}
		class="group flex flex-col justify-between overflow-hidden rounded-2xl bg-shop-ink p-5 text-white"
	>
		<div>
			<h2 class="text-lg leading-snug font-bold">
				Offre <span class="text-shop-orange">marque</span>
			</h2>
			<p class="mt-1 text-xs text-white/60">Emplacement promo — visuel 600 × 400 à fournir</p>
		</div>
		<span
			class="mt-3 w-fit text-xs font-semibold tracking-wide uppercase underline underline-offset-4"
		>
			Découvrir
		</span>
	</a>

	<!-- Conseil : le bleu porte le service et la confiance -->
	<div class="flex flex-col justify-between rounded-2xl bg-primary-800 p-5 text-white">
		<div>
			<UserHeadsetOutline class="h-6 w-6 text-white/80" />
			<h2 class="mt-2 text-base leading-snug font-bold">Un doute sur une référence ?</h2>
			<p class="mt-1 text-xs text-primary-200">Nos experts vous guident.</p>
		</div>
		<Button
			size="sm"
			href="tel:0950922336"
			class="mt-3 w-fit bg-white text-primary-800 hover:bg-primary-50"
		>
			<PhoneSolid class="me-1.5 h-3.5 w-3.5" /> 09 50 92 23 36
		</Button>
	</div>
</section>

<!-- ================= Marques & top catégories ================= -->
<section class="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-8">
	{#if data.brands.length > 0}
		<div>
			<div class="mb-5 flex items-end justify-between gap-4 border-b border-shop-border pb-3">
				<h2 class="text-lg font-extrabold tracking-wide text-shop-ink uppercase">Nos marques</h2>
				<a href="/recherche" class="text-sm font-semibold text-shop-blue hover:underline">
					Voir tout
				</a>
			</div>
			<div class="grid grid-cols-3 gap-3">
				{#each data.brands.slice(0, 9) as brandItem (brandItem.id)}
					<div
						class="flex h-20 items-center justify-center rounded-xl border border-shop-border/70 bg-white p-3"
					>
						{#if brandItem.logoUrl}
							<img
								src={brandItem.logoUrl}
								alt={brandItem.name}
								loading="lazy"
								class="max-h-full max-w-full object-contain"
							/>
						{:else}
							<span
								class="text-center text-xs font-semibold tracking-wide text-shop-muted uppercase"
							>
								{brandItem.name}
							</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if data.menu.length > 0}
		<div>
			<div class="mb-5 flex items-end justify-between gap-4 border-b border-shop-border pb-3">
				<h2 class="text-lg font-extrabold tracking-wide text-shop-ink uppercase">Top catégories</h2>
				<a href="/recherche" class="text-sm font-semibold text-shop-blue hover:underline">
					Tout le catalogue
				</a>
			</div>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each data.menu.slice(0, 6) as entry, i (entry.id)}
					{@const Icon = categoryIcons[i % categoryIcons.length]}
					<a
						href="/categorie/{entry.slug}"
						class="group flex flex-col items-center rounded-xl bg-shop-subtle px-3 py-5 text-center transition-colors hover:bg-primary-100"
					>
						<span class="flex h-11 w-11 items-center justify-center rounded-full bg-white">
							<Icon class="h-5 w-5 text-primary-700" />
						</span>
						<span class="mt-2.5 text-sm leading-tight font-semibold text-shop-ink">
							{entry.name}
						</span>
						<span class="mt-0.5 text-xs text-shop-muted">
							{entry.children.length > 0 ? `${entry.children.length} sous-cat.` : 'Voir'}
						</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</section>

<!-- ================= Nouveaux produits ================= -->
<section class="mt-14">
	<div class="mb-6 flex items-end justify-between gap-4">
		<div>
			<h2 class="text-xl font-extrabold tracking-wide text-shop-ink uppercase">
				Nouveaux produits
			</h2>
			<p class="mt-1 text-sm text-shop-muted">Les dernières références ajoutées au catalogue</p>
		</div>
		<a
			href="/recherche"
			class="hidden shrink-0 items-center gap-1 text-sm font-semibold text-shop-blue hover:underline sm:flex"
		>
			Voir tout <ArrowRightOutline class="h-4 w-4" />
		</a>
	</div>
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
		{#each data.latest as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>
</section>

<!-- ================= Professionnels ================= -->
<section
	class="mt-14 flex flex-col items-center justify-between gap-4 rounded-2xl bg-primary-700 px-6 py-5 text-white sm:flex-row sm:px-8"
	aria-label="Professionnels et collectivités"
>
	<p class="text-center text-sm sm:text-left">
		<span class="font-bold">Professionnels & collectivités</span>
		<span class="text-primary-200">
			— tarifs HT, mandat administratif et paiement Chorus, avec un interlocuteur dédié.
		</span>
	</p>
	<Button
		size="sm"
		href="tel:0950922336"
		class="shrink-0 bg-white text-primary-800 hover:bg-primary-50"
	>
		Nous contacter
	</Button>
</section>

<!-- ================= Newsletter ================= -->
<section class="mt-14 rounded-2xl bg-shop-subtle px-6 py-10 sm:px-10" aria-label="Newsletter">
	<div class="mx-auto flex max-w-3xl flex-col items-center text-center">
		<span class="flex h-12 w-12 items-center justify-center rounded-full bg-white">
			<EnvelopeOutline class="h-6 w-6 text-shop-blue" />
		</span>
		<h2 class="mt-4 text-xl font-extrabold tracking-wide text-shop-ink uppercase">
			Restez informé
		</h2>
		<p class="mt-2 max-w-md text-sm text-shop-muted">
			Nouveautés, arrivages et offres de déstockage : une fois par mois, rien de plus.
		</p>
		<form class="mt-6 flex w-full max-w-md gap-2">
			<Input
				type="email"
				placeholder="Votre adresse email"
				class="bg-white"
				aria-label="Adresse email"
				disabled
			/>
			<Button disabled>S'inscrire</Button>
		</form>
		<p class="mt-2 text-xs text-shop-muted">Inscription bientôt disponible.</p>
	</div>
</section>

<!-- ================= Le spécialiste, en chiffres ================= -->
<section
	class="mt-14 mb-2 rounded-2xl bg-primary-800 px-8 py-12 text-white lg:px-12"
	aria-label="MS Shop en chiffres"
>
	<div class="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
		<div class="max-w-xl">
			<h2 class="text-2xl font-bold sm:text-3xl">
				Le spécialiste motoculture,<br />depuis plus de 30 ans.
			</h2>
			<p class="mt-3 text-sm text-primary-200">
				Un magasin, un atelier, et l'un des plus grands catalogues de pièces détachées de France —
				au service des particuliers comme des professionnels.
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<Button href="/recherche" class="bg-white text-primary-800 hover:bg-primary-50">
					Découvrir le catalogue <ArrowRightOutline class="ms-2 h-4 w-4" />
				</Button>
				<Button
					href="tel:0950922336"
					color="alternative"
					class="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
				>
					<PhoneSolid class="me-2 h-4 w-4" /> 09 50 92 23 36
				</Button>
			</div>
		</div>

		<dl class="grid shrink-0 grid-cols-3 gap-8 text-center lg:gap-12 lg:text-left">
			<div class="flex flex-col-reverse">
				<dt class="mt-1 text-xs font-medium tracking-widest text-primary-300 uppercase">
					Références
				</dt>
				<dd class="text-3xl font-extrabold sm:text-4xl">{totalMillions}M+</dd>
			</div>
			<div class="flex flex-col-reverse">
				<dt class="mt-1 text-xs font-medium tracking-widest text-primary-300 uppercase">Marques</dt>
				<dd class="text-3xl font-extrabold sm:text-4xl">1&nbsp;000+</dd>
			</div>
			<div class="flex flex-col-reverse">
				<dt class="mt-1 text-xs font-medium tracking-widest text-primary-300 uppercase">Années</dt>
				<dd class="text-3xl font-extrabold sm:text-4xl">30+</dd>
			</div>
		</dl>
	</div>
</section>

<!-- ================= Texte éditorial ================= -->
<section class="mt-14 border-t border-shop-border pt-8 pb-2">
	<h2 class="text-base font-extrabold tracking-wide text-shop-ink uppercase">
		MS Shop — le spécialiste motoculture en ligne
	</h2>
	<div class="mt-3 max-w-4xl space-y-3 text-sm leading-6 text-shop-muted">
		<p>
			Depuis plus de trente ans, Meca Services accompagne particuliers, professionnels et
			collectivités dans l'entretien de leurs espaces verts. Notre boutique en ligne donne accès à
			l'un des plus grands catalogues de pièces détachées de motoculture de France : tondeuses,
			robots, débroussailleuses, tronçonneuses et micro-tracteurs des plus grandes marques —
			toujours en pièces d'origine.
		</p>
		<p>
			Basés à Carantilly, dans la Manche, nous assurons également le S.A.V et la réparation en
			atelier de tous les matériels que nous distribuons. Vues éclatées, références constructeur,
			conseils par téléphone : notre équipe vous aide à identifier la bonne pièce du premier coup,
			et l'expédie partout en France métropolitaine.
		</p>
	</div>
</section>

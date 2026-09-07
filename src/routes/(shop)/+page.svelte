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
	import HomeSlider from '$lib/components/shop/HomeSlider.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
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

	const slides: Slide[] = $derived([
		{
			eyebrow: '30 ans d’expérience',
			title: 'La bonne pièce, du premier coup.',
			text: `Plus de ${totalMillions} million de références de pièces détachées et de matériels de motoculture, 100 % origine.`,
			cta: 'Découvrir le catalogue',
			href: '/recherche',
			imageLabel: 'Photo d’ambiance : atelier ou matériel en situation',
			imageHint: '1200 × 640'
		},
		{
			eyebrow: 'Robots tondeuses',
			title: 'Votre pelouse, sans y penser.',
			text: 'Navimow by Segway : installation, paramétrage et S.A.V assurés par nos soins.',
			cta: 'Voir les robots',
			href: '/recherche',
			imageLabel: 'Photo : robot tondeuse en situation',
			imageHint: '1200 × 640'
		},
		{
			eyebrow: 'Professionnels & collectivités',
			title: 'Un compte pro, des avantages dédiés.',
			text: 'Tarifs HT, mandat administratif, paiement Chorus : un interlocuteur unique pour vos parcs.',
			cta: 'Nous contacter',
			href: 'tel:0950922336',
			imageLabel: 'Photo : parc de matériel professionnel',
			imageHint: '1200 × 640'
		}
	]);

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

<!-- ================= Carrousel d'accueil ================= -->
<HomeSlider {slides} />

<!-- ================= Réassurance ================= -->
<section class="mt-4 rounded-2xl bg-shop-subtle px-6 py-5" aria-label="Nos garanties">
	<div class="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
		{#each usps as usp (usp.title)}
			{@const Icon = usp.icon}
			<div class="flex items-center gap-3">
				<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
					<Icon class="h-5 w-5 text-shop-blue" />
				</span>
				<div>
					<p class="text-sm font-semibold text-shop-ink">{usp.title}</p>
					<p class="mt-0.5 hidden text-xs text-shop-muted sm:block">{usp.text}</p>
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- ================= Rayons ================= -->
{#if data.menu.length > 0}
	<section class="mt-14">
		<div class="mb-6 flex items-end justify-between gap-4">
			<div>
				<h2 class="text-2xl font-bold tracking-tight text-shop-ink">Explorez nos rayons</h2>
				<p class="mt-1 text-sm text-shop-muted">
					Matériel et pièces détachées, classés par univers
				</p>
			</div>
			<a
				href="/recherche"
				class="hidden shrink-0 items-center gap-1 text-sm font-semibold text-shop-blue hover:underline sm:flex"
			>
				Tout le catalogue <ArrowRightOutline class="h-4 w-4" />
			</a>
		</div>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
			{#each data.menu as entry, i (entry.id)}
				{@const Icon = categoryIcons[i % categoryIcons.length]}
				<a
					href="/categorie/{entry.slug}"
					class="group rounded-xl border border-shop-border bg-white p-5 transition-colors hover:border-primary-300 hover:bg-shop-subtle"
				>
					<span
						class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-100"
					>
						<Icon class="h-5 w-5 text-primary-700" />
					</span>
					<h3 class="mt-3 text-sm font-semibold text-shop-ink">{entry.name}</h3>
					<p class="mt-1 text-xs text-shop-muted">
						{entry.children.length > 0
							? `${entry.children.length} sous-catégorie${entry.children.length > 1 ? 's' : ''}`
							: 'Voir le rayon'}
					</p>
				</a>
			{/each}
		</div>
	</section>
{/if}

<!-- ================= Nouveaux produits ================= -->
<section class="mt-14">
	<div class="mb-6 flex items-end justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold tracking-tight text-shop-ink">Nouveaux produits</h2>
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

<!-- ================= Bandeaux promo & conseil ================= -->
<section class="mt-14 grid gap-4 lg:grid-cols-2">
	<!-- Déstockage : l'orange est le signal commercial de la charte -->
	<a
		href={clearanceHref}
		class="group flex flex-col justify-between rounded-2xl bg-shop-orange-deep p-8 text-white transition-colors hover:bg-shop-orange"
	>
		<div>
			<TagOutline class="h-8 w-8 text-white/80" />
			<h2 class="mt-3 text-2xl font-bold">Déstockage & promotions</h2>
			<p class="mt-2 text-sm text-white/85">
				Matériels et pièces à prix réduits, dans la limite des stocks disponibles.
			</p>
		</div>
		<span class="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">
			J'en profite
			<ArrowRightOutline class="h-4 w-4 transition-transform group-hover:translate-x-1" />
		</span>
	</a>

	<!-- Conseil : le bleu porte le service et la confiance -->
	<div class="flex flex-col justify-between rounded-2xl bg-primary-800 p-8 text-white">
		<div>
			<UserHeadsetOutline class="h-8 w-8 text-white/80" />
			<h2 class="mt-3 text-2xl font-bold">Besoin d'aide pour trouver une pièce ?</h2>
			<p class="mt-2 text-sm text-primary-200">
				Vues éclatées, références constructeur : nos experts vous guident du lundi au vendredi,
				9h-12h et 14h-18h.
			</p>
		</div>
		<Button href="tel:0950922336" class="mt-6 w-fit bg-white text-primary-800 hover:bg-primary-50">
			<PhoneSolid class="me-2 h-4 w-4" /> 09 50 92 23 36
		</Button>
	</div>
</section>

<!-- ================= Marques ================= -->
{#if data.brands.length > 0}
	<section class="mt-14">
		<div class="mb-6">
			<h2 class="text-2xl font-bold tracking-tight text-shop-ink">Nos marques partenaires</h2>
			<p class="mt-1 text-sm text-shop-muted">
				Plus de 1&nbsp;000 marques distribuées — pièces et matériels d'origine
			</p>
		</div>
		<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
			{#each data.brands as brandItem (brandItem.id)}
				<div
					class="flex h-24 items-center justify-center rounded-xl border border-shop-border bg-white p-4"
				>
					{#if brandItem.logoUrl}
						<img
							src={brandItem.logoUrl}
							alt={brandItem.name}
							loading="lazy"
							class="max-h-full max-w-full object-contain"
						/>
					{:else}
						<ImagePlaceholder label="Logo {brandItem.name}" class="border-0 bg-transparent" />
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/if}

<!-- ================= Newsletter ================= -->
<section class="mt-14 rounded-2xl bg-shop-subtle px-6 py-10 sm:px-10" aria-label="Newsletter">
	<div class="mx-auto flex max-w-3xl flex-col items-center text-center">
		<span class="flex h-12 w-12 items-center justify-center rounded-full bg-white">
			<EnvelopeOutline class="h-6 w-6 text-shop-blue" />
		</span>
		<h2 class="mt-4 text-2xl font-bold tracking-tight text-shop-ink">Restez informé</h2>
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

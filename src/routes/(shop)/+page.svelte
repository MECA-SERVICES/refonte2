<script lang="ts">
	import { formatNumber } from '$lib/money';
	import PartFinder from '$lib/components/shop/PartFinder.svelte';
	import PromoSlider, { type PromoSlide } from '$lib/components/shop/PromoSlider.svelte';
	import UniverseCard from '$lib/components/shop/UniverseCard.svelte';
	import PromoTile from '$lib/components/shop/PromoTile.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import ArticleCard from '$lib/components/shop/ArticleCard.svelte';
	import {
		LandmarkOutline,
		ShieldCheckOutline,
		ToolsOutline,
		TruckOutline
	} from 'flowbite-svelte-icons';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Sélecteur de pièce : listes de départ, à brancher sur la compatibilité. */
	const finderBrands = [
		'Husqvarna',
		'Briggs & Stratton',
		'EGO Power+',
		'Iseki',
		'Outils Wolf',
		'Stiga',
		'Honda',
		'Kawasaki'
	];
	const finderTypes = [
		'Tondeuse',
		'Tracteur tondeuse',
		'Robot de tonte',
		'Tronçonneuse',
		'Débroussailleuse',
		'Motoculteur / motobineuse',
		'Souffleur',
		'Taille-haie'
	];
	const finderModels = ['550 XP Mark II', '135 Mark II', '120i', 'T540i XP'];

	/**
	 * Offres mises en avant dans le hero.
	 *
	 * Visuels de démonstration : à remplacer par des photos du parc Meca
	 * Services avant la mise en ligne. À brancher plus tard sur les produits
	 * réellement en promotion, une fois les prix barrés renseignés en base.
	 */
	const promoSlides: PromoSlide[] = [
		{
			badge: 'Robots de tonte · −15 %',
			brand: 'Segway Navimow',
			name: 'Segway Navimow : la tonte sans fil périphérique',
			price: 1299,
			was: 1529,
			note: 'Guidage satellite, jusqu’à 2 500 m². Installation et mise en service assurées par notre atelier.',
			href: '/recherche?q=Navimow',
			video:
				'https://www.youtube-nocookie.com/embed/iYFgc9uQyKg?autoplay=1&mute=1&loop=1&playlist=iYFgc9uQyKg&controls=0&rel=0&modestbranding=1&playsinline=1',
			image: '/promo/promo-robot-tonte.jpg',
			imageLabel: 'Robot de tonte en action',
			cta: 'Découvrir la gamme'
		},
		{
			badge: 'Pros & collectivités',
			brand: 'Iseki',
			name: 'Iseki SRA 950F — débroussailleuse autoportée 4 roues motrices',
			note: 'Talus, fossés, terrains difficiles. Devis sous 24 h, mandat administratif accepté.',
			href: '/contact?devis=1',
			image: '/promo/promo-autoportee-pro.jpg',
			imageLabel: 'Débroussailleuse autoportée au travail',
			cta: 'Demander un devis'
		},
		{
			badge: 'Déstockage 2025',
			brand: 'Stiga',
			name: 'Tracteur tondeuse Stiga TS 242TXD — 98 cm',
			price: 3190,
			was: 3490,
			note: '2 dernières unités en stock atelier, livrées montées et contrôlées.',
			href: '/recherche?q=Stiga',
			image: '/promo/promo-tracteur-tondeuse.jpg',
			imageLabel: 'Tracteur tondeuse',
			cta: 'Voir l’offre'
		},
		{
			badge: 'Préparation hiver · −15 %',
			brand: 'MS SHOP',
			name: 'Fraises à neige et produits de dégivrage',
			note: 'Jusqu’au 30 novembre — expédition sous 24 h, France, Europe et Outre-mer.',
			href: '/recherche?q=fraise',
			image: '/promo/promo-fraise-a-neige.jpg',
			imageLabel: 'Fraise à neige en action',
			cta: 'Voir la sélection'
		}
	];

	/**
	 * Portes d'entrée du catalogue réglées en back-office (10.3). Sans
	 * sélection, le bloc n'apparaît pas : les machines par type jouent déjà ce
	 * rôle juste au-dessus.
	 */
	const universes = $derived(
		data.home.categories.map((c) => ({
			title: c.name,
			subtitle: c.parentName ?? 'Voir le rayon',
			href: `/categorie/${c.slug}`,
			image: c.imageUrl,
			imageLabel: `Visuel du rayon ${c.name}`
		}))
	);

	/** Onglets des produits phares — branchés sur les deux listes réelles. */
	type ProductTab = 'stock' | 'new';
	let productTab = $state<ProductTab>('stock');
	const productTabs: { value: ProductTab; label: string }[] = [
		{ value: 'stock', label: 'En stock à l’atelier' },
		{ value: 'new', label: 'Derniers arrivages' }
	];
	/** Sélection du back-office (10.4) ; à défaut, stock atelier et arrivages. */
	const curated = $derived(data.home.products.length > 0);
	const shownProducts = $derived(
		curated ? data.home.products : productTab === 'stock' ? data.inStock : data.latest
	);

	/** Bandeau de réassurance, textes validés en réunion le 15/10/2026 (demande 10.5). */
	const services = [
		{
			icon: ToolsOutline,
			title: 'Atelier agréé',
			text: 'S.A.V assuré en Normandie, dans notre atelier de Carantilly.'
		},
		{
			icon: ShieldCheckOutline,
			title: 'Pièces 100 % d’origine ou adaptables',
			text: 'Selon votre machine et votre besoin.'
		},
		{
			icon: TruckOutline,
			title: 'Expédition 24 h à 48 h',
			text: 'Si l’article est en stock. Retrait gratuit à l’atelier.'
		},
		{
			icon: LandmarkOutline,
			title: 'Collectivités',
			text: 'Mandat administratif accepté, via Chorus Pro.'
		}
	];

	/**
	 * Marques du carrousel : logos propres repris de l'ancien site
	 * (img/cms/Logos Marques), rangés dans static/marques sous le slug de la
	 * marque. Les logos de la base, trop disparates, ne s'y prêtent pas.
	 */
	const logoBrands = [
		{ slug: 'husqvarna', name: 'Husqvarna', file: 'husqvarna.jpg' },
		{ slug: 'iseki', name: 'Iseki', file: 'iseki.jpg' },
		{ slug: 'stiga', name: 'Stiga', file: 'stiga.png' },
		{ slug: 'b-s', name: 'Briggs & Stratton', file: 'b-s.png' },
		{ slug: 'kawasaki', name: 'Kawasaki', file: 'kawasaki.jpg' },
		{ slug: 'ego-power', name: 'EGO Power+', file: 'ego-power.png' },
		{ slug: 'etesia', name: 'Etesia', file: 'etesia.jpg' },
		{ slug: 'kohler', name: 'Kohler', file: 'kohler.png' },
		{ slug: 'mtd', name: 'MTD', file: 'mtd.png' },
		{ slug: 'orec', name: 'Orec', file: 'orec.png' },
		{ slug: 'agria', name: 'Agria', file: 'agria.png' },
		{ slug: 'alpina', name: 'Alpina', file: 'alpina.png' },
		{ slug: 'bahco', name: 'Bahco', file: 'bahco.png' },
		{ slug: 'eliet', name: 'Eliet', file: 'eliet.png' },
		{ slug: 'maruyama', name: 'Maruyama', file: 'maruyama.png' },
		{ slug: 'snapper-simplicity', name: 'Snapper', file: 'snapper-simplicity.jpg' },
		{ slug: 'castelgarden', name: 'Castelgarden', file: 'castelgarden.jpg' },
		{ slug: 'weibang', name: 'Weibang', file: 'weibang.png' },
		{ slug: 'outils-wolf', name: 'Outils Wolf', file: 'outils-wolf.jpg' }
	];
</script>

<svelte:head>
	<title>MS Shop — Meca Services · Motoculture & pièces détachées</title>
	<meta
		name="description"
		content="Pièces détachées et matériel de motoculture : plus de {formatNumber(
			data.productTotal
		)} références de marque, 100 % origine. Tondeuses, robots, débroussailleuses, S.A.V expert."
	/>
</svelte:head>

<h1 class="sr-only">MECA SERVICES — Motoculture &amp; pièces détachées en Normandie</h1>

<!-- ================= Hero & sélecteur de pièce ================= -->
<section>
	<!-- Le hero sort du conteneur et couvre toute la largeur de l'écran ;
	     le layout coupe le débordement horizontal (barre de défilement). -->
	<div class="relative right-1/2 left-1/2 -mx-[50vw] -mt-5 w-screen">
		<PromoSlider slides={promoSlides} full />
	</div>

	<!-- La carte chevauche le hero : elle est l'entrée principale du catalogue. -->
	<div class="relative z-10 -mt-16 sm:mx-8">
		<PartFinder brands={finderBrands} types={finderTypes} models={finderModels} />
	</div>
</section>

<!--
	Titre de section à la manière des thèmes PrestaShop : filet gris sur toute
	la largeur, trait orange sous l'intitulé, lien d'action à droite.
-->
{#snippet sectionTitle(title: string, href?: string, linkLabel?: string)}
	<div class="mb-5 flex flex-wrap items-end justify-between gap-x-4 border-b border-shop-border">
		<h2
			class="-mb-px border-b-[3px] border-shop-orange pb-2.5 font-display text-[22px] leading-tight font-extrabold text-shop-ink"
		>
			{title}
		</h2>
		{#if href}
			<a {href} class="pb-2.5 text-sm font-bold text-shop-blue hover:underline">{linkLabel}</a>
		{/if}
	</div>
{/snippet}

<!-- ================= Engagements (10.5) ================= -->
<section class="mt-10" aria-label="Nos engagements">
	<ul
		class="grid gap-px overflow-hidden border border-shop-border-soft bg-shop-border-soft sm:grid-cols-2 lg:grid-cols-4"
	>
		{#each services as service (service.title)}
			<li class="flex items-center gap-3.5 bg-white p-5">
				<service.icon class="h-9 w-9 shrink-0 text-shop-orange" />
				<span>
					<span class="block font-display text-[15px] font-bold text-shop-ink">{service.title}</span
					>
					<span class="text-[13px] text-shop-muted">{service.text}</span>
				</span>
			</li>
		{/each}
	</ul>
</section>

<!-- ================= Tuiles promotionnelles (10.1) =================
     À la manière de Kramp, à la place de « Nos marques ». Réglées dans
     « Apparence › Page d'accueil » ; sans tuile, le bloc n'apparaît pas. -->
{#if data.home.tiles.length > 0}
	<section class="mt-12" aria-label="Promotions et sélections">
		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
			{#each data.home.tiles as tile (tile.id)}
				<PromoTile {...tile} />
			{/each}
		</div>
	</section>
{/if}

<!-- ================= Machines par type =================
     Blocs catégorie à la PrestaShop. Chaque type est illustré par une vraie
     machine du catalogue et mène à la recherche, côté machines ou côté pièces. -->
<section class="mt-12">
	{@render sectionTitle('Nos machines', '/recherche?type=produits', 'Toutes les machines')}
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		{#each data.machineTypes as machine (machine.label)}
			{@const machinesHref = `/recherche?q=${encodeURIComponent(machine.term)}&type=produits`}
			<div
				class="group flex gap-4 rounded-[10px] border border-shop-border-soft bg-white p-4 transition-shadow hover:shadow-[0_6px_22px_rgba(30,36,54,0.1)]"
			>
				<a
					href={machinesHref}
					class="block h-[104px] w-[104px] shrink-0"
					tabindex="-1"
					aria-hidden="true"
				>
					{#if machine.image}
						<img
							src={machine.image}
							alt=""
							loading="lazy"
							class="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
						/>
					{/if}
				</a>
				<div class="min-w-0">
					<a
						href={machinesHref}
						class="font-display text-base font-extrabold text-shop-ink hover:text-shop-blue"
					>
						{machine.label}
					</a>
					<ul class="mt-1.5 space-y-0.5 text-[13.5px] text-shop-muted">
						<li><a href={machinesHref} class="hover:text-shop-orange">Machines neuves</a></li>
						<li>
							<a
								href="/recherche?q={encodeURIComponent(machine.term)}&type=pieces"
								class="hover:text-shop-orange"
							>
								Pièces détachées
							</a>
						</li>
					</ul>
					<a
						href={machinesHref}
						class="mt-2.5 inline-block rounded-md bg-shop-blue px-3 py-1.5 text-[12.5px] font-bold text-white transition-colors hover:bg-shop-orange"
					>
						Voir plus
					</a>
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- ================= Catégories mises en avant (10.3) ================= -->
{#if universes.length > 0}
	<section class="mt-12">
		{@render sectionTitle('Nos rayons', '/recherche', 'Tout le catalogue')}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each universes as universe (universe.title)}
				<UniverseCard {...universe} />
			{/each}
		</div>
	</section>
{/if}

<!-- ================= Produits phares (10.4), en onglets ================= -->
<section class="mt-12">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-x-6 border-b border-shop-border">
		{#if curated}
			<h2
				class="-mb-px border-b-[3px] border-shop-orange pb-2.5 font-display text-[22px] leading-tight font-extrabold text-shop-ink"
			>
				Nos produits phares
			</h2>
		{:else}
			<div class="flex gap-6 sm:gap-8" role="tablist">
				{#each productTabs as tab (tab.value)}
					<button
						type="button"
						role="tab"
						aria-selected={productTab === tab.value}
						onclick={() => (productTab = tab.value)}
						class="-mb-px border-b-[3px] pb-2.5 font-display text-[18px] leading-tight font-extrabold transition-colors sm:text-[22px] {productTab ===
						tab.value
							? 'border-shop-orange text-shop-ink'
							: 'border-transparent text-shop-muted hover:text-shop-ink'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
			<a
				href={productTab === 'new' ? '/recherche?tri=new' : '/recherche?stock=1'}
				class="pb-2.5 text-sm font-bold text-shop-blue hover:underline"
			>
				{productTab === 'new' ? 'Toutes les nouveautés' : 'Tout le stock atelier'}
			</a>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
		<!-- Visuel de la sélection (10.4), en tête de grille. -->
		{#if curated && data.home.featuredImageUrl}
			<svelte:element
				this={data.home.featuredImageLink ? 'a' : 'div'}
				href={data.home.featuredImageLink ?? undefined}
				class="col-span-2 overflow-hidden rounded-[14px] sm:row-span-2"
			>
				<img
					src={data.home.featuredImageUrl}
					alt=""
					loading="lazy"
					class="h-full min-h-[260px] w-full object-cover"
				/>
			</svelte:element>
		{/if}
		{#each shownProducts as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>
</section>

<!-- ================= Bannières de l'atelier =================
     Les visuels du client, tels qu'il les a créés : mascotte, tampon
     « Revendeur agréé » et message. -->
<section class="mt-12 grid gap-5 md:grid-cols-2" aria-label="À la une">
	<a href="/recherche?q=robot" class="block overflow-hidden rounded-[10px]">
		<img
			src="/slider/robots-tondeuses-bientot-disponible.jpg"
			alt="Robots tondeuses bientôt disponibles : LIDAR, 4x4, NRTK, jusqu'à 24 000 m² de tonte"
			loading="lazy"
			class="aspect-[3/1] w-full object-cover object-left transition-transform duration-500 hover:scale-[1.02]"
		/>
	</a>
	<a href="/vue-eclatee" class="block overflow-hidden rounded-[10px]">
		<img
			src="/static-slider/slide.jpg"
			alt="MS Shop assure le S.A.V de tous les produits vendus sur le site"
			loading="lazy"
			class="aspect-[3/1] w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
		/>
	</a>
</section>

<!-- ================= Pièces détachées ================= -->
<section class="mt-12">
	{@render sectionTitle('Pièces détachées', '/recherche?type=pieces', 'Toutes les pièces')}
	<div class="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
		<div class="flex flex-col rounded-[10px] bg-shop-blue p-6 text-white">
			<p class="font-display text-[21px] leading-tight font-extrabold">
				Trouvez la pièce de votre machine
			</p>
			<p class="mt-2 text-[14.5px] leading-relaxed text-[#e2e7f6]">
				Vues éclatées des constructeurs, référence d'origine et stock de l'atelier.
			</p>
			<a
				href="/vue-eclatee"
				class="mt-4 rounded-md bg-shop-orange py-2.5 text-center font-display text-[15px] font-bold transition-colors hover:bg-shop-orange-deep"
			>
				Parcourir les vues éclatées
			</a>
			<div class="mt-6 border-t border-white/20 pt-4 text-[13.5px] text-[#e2e7f6] lg:mt-auto">
				Une référence introuvable ? L'atelier répond du lundi au vendredi, 9 h – 12 h et 14 h – 18
				h.
				<a href="tel:0950922336" class="mt-1 block font-display text-xl font-extrabold text-white">
					09 50 92 23 36
				</a>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			{#each data.parts as product (product.id)}
				<ProductCard {product} />
			{/each}
		</div>
	</div>
</section>

<!-- ================= Marques ================= -->
<section class="mt-12">
	{@render sectionTitle('Nos marques', '/marques', 'Toutes les marques')}
	<div
		class="flex snap-x [scrollbar-width:none] gap-px overflow-x-auto border border-shop-border-soft bg-shop-border-soft"
	>
		{#each logoBrands as brand (brand.slug)}
			<a
				href="/marque/{brand.slug}"
				title={brand.name}
				class="flex h-20 w-44 shrink-0 snap-start items-center justify-center bg-white px-5 grayscale transition hover:grayscale-0"
			>
				<img
					src="/marques/{brand.file}"
					alt={brand.name}
					loading="lazy"
					class="max-h-9 max-w-full object-contain"
				/>
			</a>
		{/each}
	</div>
</section>

<!-- ================= Blog ================= -->
{#if data.articles.length > 0}
	<section class="mt-12 mb-4">
		{@render sectionTitle('Conseils et actualités', '/blog', 'Tout le blog')}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.articles as article (article.slug)}
				<ArticleCard {article} />
			{/each}
		</div>
	</section>
{/if}

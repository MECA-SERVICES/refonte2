<script lang="ts">
	import { formatNumber } from '$lib/money';
	import PartFinder from '$lib/components/shop/PartFinder.svelte';
	import PromoSlider, { type PromoSlide } from '$lib/components/shop/PromoSlider.svelte';
	import SectionHeading from '$lib/components/shop/SectionHeading.svelte';
	import UniverseCard from '$lib/components/shop/UniverseCard.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import ArticleCard from '$lib/components/shop/ArticleCard.svelte';
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
			href: '/inscription',
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
	 * Types de machine du bloc « réparer » — chacun mène à la recherche dédiée.
	 * Photos de test Unsplash (licence libre), à remplacer par des visuels du
	 * parc Meca Services.
	 */
	const machines = [
		{
			label: 'Tondeuse',
			image:
				'https://images.unsplash.com/photo-1458245201577-fc8a130b8829?w=400&h=400&fit=crop&q=80'
		},
		{
			label: 'Tracteur tondeuse',
			image:
				'https://images.unsplash.com/photo-1630709437016-ee675b9b29b8?w=400&h=400&fit=crop&q=80'
		},
		{
			label: 'Robot de tonte',
			image:
				'https://images.unsplash.com/photo-1741326757602-186060c5d5b5?w=400&h=400&fit=crop&q=80'
		},
		{
			label: 'Tronçonneuse',
			image:
				'https://images.unsplash.com/photo-1696883186987-299ff16b0cac?w=400&h=400&fit=crop&q=80'
		},
		{
			label: 'Débroussailleuse',
			image:
				'https://images.unsplash.com/photo-1689728318937-17d24bc0a65c?w=400&h=400&fit=crop&q=80'
		},
		{
			label: 'Motoculteur',
			image:
				'https://images.unsplash.com/photo-1781999374771-5e2bbcff2e15?w=400&h=400&fit=crop&q=80'
		},
		{
			label: 'Souffleur',
			image:
				'https://images.unsplash.com/photo-1593174260957-b4eba7b3820c?w=400&h=400&fit=crop&q=80'
		},
		{
			label: 'Taille-haie',
			image: 'https://images.unsplash.com/photo-1543309959-4d45288d1629?w=400&h=400&fit=crop&q=80'
		}
	];

	/** Visuels d'attente des cartes catégorie, en attendant les photos par rayon. */
	const universeImages = [
		'/promo/promo-tracteur-tondeuse.jpg',
		'/promo/promo-robot-tonte.jpg',
		'/promo/promo-autoportee-pro.jpg'
	];

	/** Trois grandes portes d'entrée du catalogue. */
	const universes = $derived(
		data.menu.slice(0, 3).map((entry, i) => ({
			title: entry.name,
			subtitle: entry.children
				.slice(0, 4)
				.map((child) => child.name)
				.join(', '),
			href: `/categorie/${entry.slug}`,
			image: universeImages[i] ?? null,
			imageLabel: `Visuel du rayon ${entry.name}`
		}))
	);

	/** Onglets des produits phares — branchés sur les deux listes réelles. */
	type ProductTab = 'stock' | 'new';
	let productTab = $state<ProductTab>('stock');
	const shownProducts = $derived(productTab === 'stock' ? data.inStock : data.latest);

	const services = [
		{
			mark: 'SAV',
			title: 'S.A.V dans notre atelier',
			text: 'Réparation, entretien et garantie assurés à Carantilly, pas renvoyés à l’usine.'
		},
		{
			mark: '100',
			title: 'Pièces 100 % origine',
			text: 'Référencées constructeur, jamais d’adaptable non homologué sous garantie.'
		},
		{
			mark: '24h',
			title: 'Expédition sous 24 h',
			text: 'France, Europe et Outre-mer. Retrait gratuit à l’atelier.'
		},
		{
			mark: 'Pro',
			title: 'Pros & collectivités',
			text: 'Tarifs HT dégressifs, devis sous 24 h, mandat administratif via Chorus Pro.'
		}
	];

	const reviews = [
		{
			stars: '★★★★★',
			text: 'Pièce trouvée en 5 minutes grâce à la vue éclatée, reçue le surlendemain. Exactement la bonne référence.',
			who: 'Jean-Marc',
			where: 'Saint-Lô'
		},
		{
			stars: '★★★★★',
			text: 'On gère 40 machines, ils connaissent notre parc par cœur. Le devis part le jour même.',
			who: 'Entreprise d’espaces verts',
			where: 'Coutances'
		},
		{
			stars: '★★★★☆',
			text: 'Mandat administratif accepté sans discuter, ce qui est rare. Facturation Chorus nickel.',
			who: 'Services techniques',
			where: 'Commune de la Manche'
		}
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

<!-- ================= Marques ================= -->
{#if data.brands.length > 0}
	<section class="mt-12">
		<SectionHeading
			title="Nos marques"
			href="/marques"
			linkLabel="Toutes nos marques partenaires"
		/>
		<div class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{#each data.brands as brandItem (brandItem.id)}
				<a
					href="/marque/{brandItem.slug}"
					class="flex h-[104px] items-center justify-center rounded-xl border-[1.5px] border-shop-border-soft bg-white px-4 text-center font-display text-base font-extrabold tracking-[0.02em] text-shop-ink-soft uppercase transition-colors hover:border-shop-blue hover:text-shop-blue"
				>
					{#if brandItem.logoUrl}
						<img
							src={brandItem.logoUrl}
							alt={brandItem.name}
							loading="lazy"
							class="max-h-[64px] max-w-[85%] object-contain"
						/>
					{:else}
						{brandItem.name}
					{/if}
				</a>
			{/each}
		</div>
	</section>
{/if}

<!-- ================= Machines par type ================= -->
<section class="mt-14">
	<SectionHeading
		title="Nos machines"
		accent="par type"
		lead="Tondeuses, robots, tronçonneuses… choisissez le type de machine pour voir les produits correspondants."
	/>
	<div class="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-8">
		{#each machines as machine (machine.label)}
			<a
				href="/recherche?q={encodeURIComponent(machine.label)}"
				class="flex flex-col items-center gap-3 rounded-[14px] bg-shop-subtle px-2.5 pt-4 pb-4 text-center transition-colors hover:bg-primary-100"
			>
				<img
					src={machine.image}
					alt=""
					loading="lazy"
					class="h-[124px] w-[124px] rounded-full object-cover"
				/>
				<span class="font-display text-sm leading-tight font-bold text-shop-ink">
					{machine.label}
				</span>
			</a>
		{/each}
	</div>
</section>

<!-- ================= Catégories ================= -->
{#if universes.length > 0}
	<section class="mt-14">
		<SectionHeading title="Par" accent="catégories" href="/recherche" />
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each universes as universe (universe.title)}
				<UniverseCard {...universe} />
			{/each}
		</div>
	</section>
{/if}

<!-- ================= Produits phares ================= -->
<section class="mt-14">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
		<h2
			class="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[28px] lg:text-[32px]"
		>
			Nos produits phares
		</h2>
		<div class="flex gap-1 rounded-[10px] bg-shop-subtle p-1" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={productTab === 'stock'}
				onclick={() => (productTab = 'stock')}
				class="rounded-lg px-4 py-2 font-display text-[13.5px] font-bold transition-colors {productTab ===
				'stock'
					? 'bg-white text-shop-blue shadow-[0_1px_4px_rgba(30,36,54,0.12)]'
					: 'text-shop-muted hover:text-shop-ink'}"
			>
				Disponible immédiatement
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={productTab === 'new'}
				onclick={() => (productTab = 'new')}
				class="rounded-lg px-4 py-2 font-display text-[13.5px] font-bold transition-colors {productTab ===
				'new'
					? 'bg-white text-shop-blue shadow-[0_1px_4px_rgba(30,36,54,0.12)]'
					: 'text-shop-muted hover:text-shop-ink'}"
			>
				Derniers arrivages
			</button>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
		{#each shownProducts as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>

	<div class="mt-5 text-center">
		<a
			href={productTab === 'new' ? '/recherche?tri=new' : '/recherche?stock=1'}
			class="inline-block rounded-[10px] border-[1.5px] border-shop-border px-5 py-3 font-display text-sm font-bold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
		>
			{productTab === 'new' ? 'Toutes les nouveautés' : 'Tout le stock atelier'} →
		</a>
	</div>
</section>

<!-- ================= Tout pour ma machine ================= -->
<section class="mt-14">
	<SectionHeading title="Tout pour ma machine" />
	<div class="grid gap-4 lg:grid-cols-2">
		<div
			class="grid min-h-[340px] grid-cols-1 overflow-hidden rounded-2xl bg-shop-blue text-white sm:grid-cols-2"
		>
			<div class="flex flex-col justify-center gap-3 p-8 lg:p-9">
				<p class="font-display text-[26px] font-extrabold tracking-[-0.02em] lg:text-[28px]">
					Entretenir ma machine
				</p>
				<p class="text-[15.5px] leading-relaxed text-pretty text-[#e2e7f6]">
					Huiles, bougies, courroies, fils nylon, lames, chaînes et guides — les consommables
					d'origine pour prolonger la vie de votre matériel.
				</p>
				<a
					href="/recherche?q=consommables"
					class="mt-1.5 self-start rounded-[10px] bg-white px-4 py-2.5 font-display text-sm font-bold text-shop-blue transition-colors hover:bg-primary-100"
				>
					Voir les consommables
				</a>
			</div>
			<!-- Visuels d'ambiance Unsplash (licence libre) — à remplacer par des
			     photos de l'atelier quand elles seront disponibles. -->
			<img
				src="https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1000&q=80"
				alt="Consommables en rayon — huile, bougies, chaînes"
				loading="lazy"
				class="h-full min-h-[220px] w-full object-cover"
			/>
		</div>

		<div
			class="grid min-h-[340px] grid-cols-1 overflow-hidden rounded-2xl bg-shop-ink text-white sm:grid-cols-2"
		>
			<div class="flex flex-col justify-center gap-3 p-8 lg:p-9">
				<p class="font-display text-[26px] font-extrabold tracking-[-0.02em] lg:text-[28px]">
					Réparer ma machine
				</p>
				<p class="text-[15.5px] leading-relaxed text-pretty text-[#e2e7f6]">
					Vues éclatées de plus de 40 marques, pièces 100 % origine et un atelier qui répond au
					téléphone quand vous hésitez entre deux références.
				</p>
				<a
					href="/vue-eclatee"
					class="mt-1.5 self-start rounded-[10px] bg-shop-orange px-4 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-shop-orange-deep"
				>
					Trouver ma pièce
				</a>
			</div>
			<img
				src="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1000&q=80"
				alt="Mécanicien démontant un moteur en atelier"
				loading="lazy"
				class="h-full min-h-[220px] w-full object-cover"
			/>
		</div>
	</div>
</section>

<!-- ================= Services ================= -->
<section class="mt-14" aria-label="Nos engagements">
	<div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
		{#each services as service (service.title)}
			<div class="flex gap-3.5 rounded-[14px] border-[1.5px] border-shop-border-soft bg-white p-5">
				<span
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 font-display text-[15px] font-extrabold text-shop-blue"
				>
					{service.mark}
				</span>
				<div class="min-w-0">
					<p class="mb-1 font-display text-[15.5px] font-extrabold text-shop-ink">
						{service.title}
					</p>
					<p class="text-[13.5px] leading-normal text-pretty text-shop-muted">{service.text}</p>
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- ================= Aide ================= -->
<section class="mt-14">
	<div class="grid overflow-hidden rounded-2xl bg-shop-subtle lg:grid-cols-2">
		<img
			src="https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1000&q=80"
			alt="Conseiller Meca Services au téléphone dans l'atelier"
			loading="lazy"
			class="h-full min-h-[240px] w-full object-cover"
		/>
		<div class="flex flex-col justify-center gap-3 p-7 sm:p-10">
			<h2
				class="font-display text-2xl leading-[1.1] font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[28px]"
			>
				Une question ? Besoin d'aide pour identifier une pièce ?
			</h2>
			<p class="text-[15.5px] leading-relaxed text-pretty text-shop-ink-soft">
				L'équipe de l'atelier de Carantilly répond du lundi au vendredi, 9 h – 12 h et 14 h – 18 h.
				Envoyez-nous une photo de la plaque constructeur, on identifie la référence pour vous.
			</p>
			<div class="mt-1">
				<a
					href="tel:0950922336"
					class="font-display text-[26px] font-extrabold tracking-[-0.01em] text-shop-blue"
				>
					09 50 92 23 36
				</a>
			</div>
			<div class="mt-1.5 flex flex-wrap gap-2.5">
				<a
					href="/inscription"
					class="rounded-[10px] bg-shop-blue px-5 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-shop-blue-dark"
				>
					Demander un devis pro
				</a>
				<a
					href="/vue-eclatee"
					class="rounded-[10px] border-[1.5px] border-shop-border bg-white px-5 py-3 font-display text-sm font-bold text-shop-ink transition-colors hover:border-shop-blue"
				>
					Identifier ma pièce
				</a>
			</div>
		</div>
	</div>
</section>

<!-- ================= Avis ================= -->
<section class="mt-14" aria-label="Avis clients">
	<SectionHeading title="Les avis de nos clients">
		<span class="text-sm text-shop-muted">
			<strong class="font-display text-base text-shop-ink">4,5 / 5</strong> · 42 avis vérifiés
		</span>
	</SectionHeading>
	<div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
		{#each reviews as review (review.who)}
			<figure
				class="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-shop-border-soft bg-white p-5"
			>
				<p class="text-[15px] tracking-[0.12em] text-shop-orange" aria-label="Note">
					{review.stars}
				</p>
				<blockquote class="text-[15px] leading-relaxed text-pretty text-shop-ink">
					{review.text}
				</blockquote>
				<figcaption class="mt-auto text-[13px] text-shop-muted">
					<strong class="text-shop-ink">{review.who}</strong> · {review.where}
				</figcaption>
			</figure>
		{/each}
	</div>
</section>

<!-- ================= Blog ================= -->
{#if data.articles.length > 0}
	<section class="mt-14 mb-4">
		<SectionHeading title="Conseils" accent="& actualités" href="/blog" linkLabel="Tout le blog" />
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.articles as article (article.slug)}
				<ArticleCard {article} />
			{/each}
		</div>
	</section>
{/if}

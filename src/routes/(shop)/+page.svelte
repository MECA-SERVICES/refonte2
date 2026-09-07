<script lang="ts">
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import PartFinder from '$lib/components/shop/PartFinder.svelte';
	import SectionHeading from '$lib/components/shop/SectionHeading.svelte';
	import RuledGrid from '$lib/components/shop/RuledGrid.svelte';
	import AudienceCard from '$lib/components/shop/AudienceCard.svelte';
	import UniverseCard from '$lib/components/shop/UniverseCard.svelte';
	import ProductCarousel from '$lib/components/shop/ProductCarousel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const fmt = new Intl.NumberFormat('fr-FR');

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
		'Tronçonneuse',
		'Tondeuse',
		'Robot de tonte',
		'Débroussailleuse',
		'Souffleur',
		'Micro-tracteur'
	];
	const finderModels = ['550 XP Mark II', '135 Mark II', '120i', 'T540i XP'];

	const reassurance = [
		{
			title: 'Pièces 100 % origine',
			text: "Référencées constructeur, jamais d'adaptable non homologué sous garantie."
		},
		{
			title: 'SAV dans notre atelier',
			text: "Réparation, entretien et garantie assurés à Carantilly, pas renvoyés à l'usine."
		},
		{
			title: 'Expédition sous 24 h',
			text: 'France, Europe et Outre-mer. Retrait gratuit sur place.'
		},
		{
			title: 'Mandat administratif',
			text: 'Collectivités : facturation Chorus Pro, sans carte bancaire.'
		}
	];

	/** Les trois publics de la boutique, chacun avec sa condition tarifaire. */
	const audiences = [
		{
			title: 'Particuliers',
			text: 'Une machine à entretenir, une pièce à remplacer. On vous dit quoi commander et comment le monter.',
			detail: 'Prix TTC · Garantie 2 ans',
			cta: 'Voir le jardin & la motoculture',
			href: '/recherche'
		},
		{
			title: 'Pros & paysagistes',
			text: "Tarifs dégressifs, encours sur facture, pièces d'usure en stock permanent.",
			detail: 'Prix HT · Compte pro en 48 h',
			cta: 'Ouvrir un compte pro',
			href: '/inscription'
		},
		{
			title: 'Collectivités',
			text: 'Devis conforme, marché public, paiement sur mandat administratif via Chorus Pro.',
			detail: 'Devis sous 24 h ouvrées',
			cta: 'Demander un devis',
			href: '/inscription'
		}
	];

	/** Univers du catalogue, appariés aux rayons réels quand ils existent. */
	const universes = [
		{
			title: 'Motoculture',
			subtitle: 'Tondeuses, robots, débroussailleuses',
			imageLabel: 'Tondeuse autoportée'
		},
		{
			title: 'Pièces détachées',
			subtitle: '40 marques · vues éclatées',
			imageLabel: 'Pièces en rayon'
		},
		{
			title: 'Travail du bois',
			subtitle: 'Tronçonneuses, fendeuses, broyeurs',
			imageLabel: 'Tronçonneuse'
		},
		{ title: 'Agriculture', subtitle: 'Semis, fenaison, pulvérisation', imageLabel: 'Tracteur' },
		{
			title: 'Hydraulique & entraînement',
			subtitle: 'Vérins, flexibles, roulements',
			imageLabel: 'Flexibles hydrauliques'
		},
		{
			title: 'Atelier & shop',
			subtitle: 'Outillage, EPI, consommables',
			imageLabel: "Établi d'atelier"
		},
		{ title: 'Jardin', subtitle: 'Outils, semences, arrosage', imageLabel: 'Outils de jardin' },
		{ title: 'Équipement cheval', subtitle: 'Écurie, box, sellerie', imageLabel: 'Sellerie' }
	];

	/** Rattache un univers au rayon correspondant, à défaut à la recherche. */
	function universeHref(title: string) {
		const match = data.menu
			.flatMap((entry) => entry.children)
			.find((child) => child.name.toLowerCase() === title.toLowerCase());
		return match ? `/categorie/${match.slug}` : `/recherche?q=${encodeURIComponent(title)}`;
	}

	const stats = [
		{ n: '15 ans', l: "d'atelier en Normandie" },
		{ n: '40', l: 'marques référencées' },
		{ n: '4,5/5', l: 'sur 42 avis clients' }
	];

	const reviews = [
		{
			note: '★★★★★',
			text: 'Pièce trouvée en 5 minutes grâce à la vue éclatée, reçue le surlendemain. Exactement la bonne référence.',
			who: 'Jean-Marc, Saint-Lô'
		},
		{
			note: '★★★★★',
			text: 'On gère 40 machines, ils connaissent notre parc par cœur. Le devis part le jour même.',
			who: "Entreprise d'espaces verts, Coutances"
		},
		{
			note: '★★★★☆',
			text: 'Mandat administratif accepté sans discuter, ce qui est rare. Facturation Chorus nickel.',
			who: 'Services techniques, commune de la Manche'
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

<!-- ================= Accroche & sélecteur de pièce ================= -->
<section class="grid items-start gap-10 pt-6 lg:grid-cols-2">
	<div class="min-w-0">
		<p
			class="mb-4 inline-block bg-shop-blue px-2.5 py-1.5 font-display text-[11.5px] font-bold tracking-[0.14em] text-shop-subtle uppercase"
		>
			Spécialiste depuis 2009 · Normandie
		</p>
		<h1
			class="font-display text-[34px] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-shop-ink sm:text-5xl lg:text-[58px]"
		>
			La bonne pièce,<br />du premier coup.
		</h1>
		<p class="mt-4 mb-6 max-w-[46ch] text-[17px] leading-relaxed text-pretty text-shop-ink-soft">
			Dites-nous quelle machine vous avez. On vous sort la vue éclatée, la référence d'origine et le
			stock atelier — sans deviner, sans commander deux fois.
		</p>

		<PartFinder brands={finderBrands} types={finderTypes} models={finderModels} />
	</div>

	<div class="min-w-0">
		<ImagePlaceholder
			label="Photo atelier : mécanicien et machine en réparation"
			hint="format paysage"
			class="h-[430px] rounded-none"
		/>
		<div class="mt-3 grid grid-cols-2 gap-3">
			<ImagePlaceholder label="Rayon pièces" class="h-[150px] rounded-none" />
			<ImagePlaceholder label="Préparation commande" class="h-[150px] rounded-none" />
		</div>
	</div>
</section>

<!-- ================= Réassurance ================= -->
<section class="mt-9" aria-label="Nos engagements">
	<RuledGrid>
		{#each reassurance as item (item.title)}
			<div class="bg-shop-subtle p-5">
				<p class="mb-1.5 font-display text-[15px] font-extrabold text-shop-ink">{item.title}</p>
				<p class="text-[13.5px] leading-relaxed text-shop-muted">{item.text}</p>
			</div>
		{/each}
	</RuledGrid>
</section>

<!-- ================= Publics ================= -->
<section class="mt-14">
	<SectionHeading
		title="Vous venez pour"
		accent="quoi"
		lead="Trois façons d'acheter chez nous — le tarif et les documents s'adaptent."
	/>
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each audiences as item (item.title)}
			<AudienceCard {...item} />
		{/each}
	</div>
</section>

<!-- ================= Univers ================= -->
<section class="mt-14">
	<SectionHeading title="Nos" accent="univers" href="/recherche" />
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each universes as universe (universe.title)}
			<UniverseCard {...universe} href={universeHref(universe.title)} />
		{/each}
	</div>
</section>

<!-- ================= Produits ================= -->
{#if data.inStock.length > 0}
	<ProductCarousel
		title="Disponible immédiatement"
		products={data.inStock}
		href="/recherche"
		linkLabel="Tout le catalogue"
	/>
{/if}

{#if data.latest.length > 0}
	<ProductCarousel title="Derniers arrivages" products={data.latest} href="/recherche?tri=new" />
{/if}

<!-- ================= Marques ================= -->
{#if data.brands.length > 0}
	<section class="mt-14">
		<div class="grid items-center gap-8 bg-shop-blue p-8 lg:grid-cols-2">
			<div>
				<p
					class="mb-3 font-display text-[11.5px] font-bold tracking-[0.14em] text-shop-on-dark-dim uppercase"
				>
					Pièces d'origine · 40 marques
				</p>
				<h2
					class="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-shop-subtle"
				>
					On ne vend que de l'origine ou de l'adaptable homologué.
				</h2>
				<p class="mt-2.5 max-w-[44ch] text-[15px] leading-relaxed text-shop-on-dark">
					Husqvarna, Briggs & Stratton, EGO Power+, Iseki, Outils Wolf, Stiga, Honda, Kawasaki,
					Kohler, Dolmar, Etesia, Kramp… et le SAV derrière, en atelier.
				</p>
			</div>

			<div class="grid grid-cols-3 gap-2.5 lg:grid-cols-4">
				{#each data.brands.slice(0, 12) as brandItem (brandItem.id)}
					<a
						href="/recherche?q={encodeURIComponent(brandItem.name)}"
						class="flex h-14 items-center justify-center bg-shop-subtle px-2 text-center font-display text-[13px] font-bold text-shop-ink"
					>
						{#if brandItem.logoUrl}
							<img
								src={brandItem.logoUrl}
								alt={brandItem.name}
								loading="lazy"
								class="max-h-full max-w-full object-contain"
							/>
						{:else}
							{brandItem.name}
						{/if}
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- ================= L'atelier ================= -->
<section class="mt-14 grid items-center gap-8 lg:grid-cols-2">
	<ImagePlaceholder
		label="Équipe ou façade de l'atelier à Carantilly"
		class="h-[340px] rounded-none"
	/>
	<div>
		<blockquote
			class="font-quote text-[22px] leading-snug tracking-[-0.01em] text-pretty italic sm:text-3xl"
		>
			« On répare les machines qu'on vend. C'est pour ça qu'on sait exactement quelle pièce il vous
			faut. »
		</blockquote>
		<p class="mt-4 text-sm text-shop-muted">L'équipe MECA SERVICES — Carantilly, Manche</p>

		<dl class="mt-6 flex flex-wrap gap-7">
			{#each stats as stat (stat.l)}
				<div class="flex flex-col-reverse">
					<dt class="text-[13px] text-shop-muted">{stat.l}</dt>
					<dd class="font-display text-[28px] font-extrabold tracking-[-0.02em] text-shop-ink">
						{stat.n}
					</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<!-- ================= Avis ================= -->
<section class="mt-12 border-t border-shop-border pt-7 pb-4" aria-label="Avis clients">
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each reviews as review (review.who)}
			<figure>
				<p class="mb-2 font-display text-sm font-bold text-shop-red">{review.note}</p>
				<blockquote class="text-[14.5px] leading-relaxed text-shop-ink-soft">
					{review.text}
				</blockquote>
				<figcaption class="mt-2 text-[13px] text-shop-muted">{review.who}</figcaption>
			</figure>
		{/each}
	</div>
</section>

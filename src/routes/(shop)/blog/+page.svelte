<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ArticleCard from '$lib/components/shop/ArticleCard.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	/** Le premier article publié occupe la une ; les suivants passent en grille. */
	const featured = $derived(data.articles[0]);
	const rest = $derived(data.articles.slice(1));

	/** Un lien externe mène directement à sa destination. */
	const featuredHref = $derived(
		featured?.contentType === 'external_link' && featured.externalUrl
			? featured.externalUrl
			: `/blog/${featured?.slug}`
	);
</script>

<svelte:head>
	<title>Blog — MS Shop</title>
	<meta
		name="description"
		content="Conseils d'entretien, tutoriels et actualités de la motoculture par MS Shop."
	/>
</svelte:head>

<Breadcrumb items={[{ label: 'Blog' }]} />

<div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
	<div>
		<Heading as="h1" size="page">Conseils &amp; actualités</Heading>
		<p class="mt-2 max-w-[60ch] text-[16.5px] text-pretty text-shop-muted">
			Entretien, réglages, choix du matériel : ce que notre atelier voit passer tous les jours.
		</p>
	</div>

	{#if data.roots.length > 0}
		<!-- Premier niveau seulement : les sous-catégories s'atteignent depuis leur parent. -->
		<nav class="flex flex-wrap gap-2" aria-label="Catégories du blog">
			<span
				class="flex items-center gap-2 rounded-full border-[1.5px] border-shop-ink bg-shop-ink px-3.5 py-2 font-display text-[13.5px] font-bold text-white"
			>
				Tous les articles
				<span class="text-xs text-shop-on-dark-dim">{data.articles.length}</span>
			</span>
			{#each data.roots as category (category.slug)}
				<a
					href="/blog/categorie/{category.slug}"
					class="flex items-center gap-2 rounded-full border-[1.5px] border-shop-border bg-white px-3.5 py-2 font-display text-[13.5px] font-bold text-shop-ink transition-colors hover:border-shop-ink"
				>
					{category.name}
					<span class="text-xs text-shop-faint">{category.branchCount}</span>
				</a>
			{/each}
		</nav>
	{/if}
</div>

{#if data.articles.length === 0}
	<Panel class="mt-8 px-6 py-12 text-center">
		<p class="text-shop-muted">Aucun article publié pour le moment.</p>
	</Panel>
{:else}
	<!-- ================= À la une ================= -->
	<a
		href={featuredHref}
		target={featured.contentType === 'external_link' ? '_blank' : undefined}
		rel={featured.contentType === 'external_link' ? 'noopener' : undefined}
		class="group mt-7 grid overflow-hidden rounded-[20px] bg-shop-ink text-white sm:min-h-[400px] sm:grid-cols-2"
	>
		<div class="relative min-h-[220px] sm:min-h-[260px]">
			{#if featured.coverImageUrl}
				<img
					src={featured.coverImageUrl}
					alt=""
					class="absolute inset-0 h-full w-full object-cover"
				/>
			{:else}
				<ImagePlaceholder
					label={featured.title}
					class="absolute inset-0 border-0 bg-shop-blue-dark text-shop-on-dark"
				/>
			{/if}
			<span
				class="absolute top-4 left-4 rounded-full bg-shop-orange px-3 py-1.5 font-display text-xs font-extrabold tracking-[0.08em] uppercase"
			>
				À la une
			</span>
		</div>

		<div class="flex flex-col justify-center gap-3.5 p-7 sm:p-10">
			<p class="text-xs font-bold tracking-[0.12em] text-shop-on-dark-dim uppercase">
				{#if featured.categoryName}{featured.categoryName}{/if}
				{#if featured.publishedAt}
					· {dateFmt.format(new Date(featured.publishedAt))}{/if}
			</p>
			<p
				class="font-display text-2xl leading-[1.1] font-extrabold tracking-[-0.02em] text-balance sm:text-[30px] lg:text-[34px]"
			>
				{featured.title}
			</p>
			{#if featured.excerpt}
				<p class="line-clamp-4 text-base leading-relaxed text-pretty text-[#e2e7f6]">
					{featured.excerpt}
				</p>
			{/if}
			<span
				class="mt-1.5 self-start rounded-[10px] bg-white px-5 py-3 font-display text-sm font-bold text-shop-ink transition-colors group-hover:bg-primary-100"
			>
				Lire l'article →
			</span>
		</div>
	</a>

	{#if rest.length > 0}
		<div class="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each rest as article (article.slug)}
				<ArticleCard {article} />
			{/each}
		</div>
	{/if}
{/if}

<!-- ================= Newsletter ================= -->
<div
	class="mt-12 mb-4 grid items-center gap-6 rounded-2xl bg-shop-subtle p-7 sm:p-8 lg:grid-cols-2"
>
	<div>
		<p class="font-display text-[22px] font-extrabold tracking-[-0.02em] text-shop-ink">
			Les conseils de l'atelier, une fois par mois
		</p>
		<p class="mt-1.5 text-[14.5px] text-shop-muted">
			Entretien de saison, nouveautés, bons plans. Pas de spam, désinscription en un clic.
		</p>
	</div>
	<!-- Collecte à brancher (liste de diffusion) : le formulaire matérialise
	     l'emplacement prévu par la maquette sans envoyer nulle part. -->
	<form
		class="flex overflow-hidden rounded-[10px] border-[1.5px] border-shop-border bg-white"
		aria-label="Inscription à la newsletter"
	>
		<label class="sr-only" for="blog-newsletter-email">Votre e-mail</label>
		<input
			id="blog-newsletter-email"
			type="email"
			placeholder="Votre e-mail"
			class="min-w-0 flex-1 border-0 px-4 py-3 text-[15px] text-shop-ink focus:ring-0"
		/>
		<button
			type="submit"
			class="border-0 bg-shop-blue px-5 font-display text-sm font-bold text-white transition-colors hover:bg-shop-blue-dark"
		>
			S'abonner
		</button>
	</form>
</div>

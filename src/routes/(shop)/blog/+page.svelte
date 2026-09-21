<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ArticleCard from '$lib/components/shop/ArticleCard.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Blog — MS Shop</title>
	<meta
		name="description"
		content="Conseils d'entretien, tutoriels et actualités de la motoculture par MS Shop."
	/>
</svelte:head>

<Breadcrumb items={[{ label: 'Blog' }]} />

<h1
	class="font-display text-[28px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[38px]"
>
	Conseils &amp; actualités
</h1>
<p class="mt-2 max-w-[64ch] text-base text-shop-muted">
	Entretien, réglages, choix du matériel : ce que notre atelier voit passer tous les jours.
</p>

{#if data.roots.length > 0}
	<!-- Premier niveau seulement : les sous-catégories s'atteignent depuis leur parent. -->
	<nav class="mt-6 flex flex-wrap gap-2" aria-label="Catégories du blog">
		<span
			class="border-[1.5px] border-shop-ink bg-shop-ink px-3 py-1.5 font-display text-[13px] font-bold text-white"
		>
			Tous les articles
		</span>
		{#each data.roots as category (category.slug)}
			<a
				href="/blog/categorie/{category.slug}"
				class="border-[1.5px] border-shop-border bg-white px-3 py-1.5 font-display text-[13px] font-bold text-shop-ink hover:border-shop-ink"
			>
				{category.name}
				<span class="text-shop-muted">({category.branchCount})</span>
			</a>
		{/each}
	</nav>
{/if}

{#if data.articles.length === 0}
	<Panel class="mt-8 px-6 py-12 text-center">
		<p class="text-shop-muted">Aucun article publié pour le moment.</p>
	</Panel>
{:else}
	<div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.articles as article (article.slug)}
			<ArticleCard {article} />
		{/each}
	</div>
{/if}

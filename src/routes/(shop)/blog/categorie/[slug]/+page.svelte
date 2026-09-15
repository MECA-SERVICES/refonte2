<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ArticleCard from '$lib/components/shop/ArticleCard.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.current.name} — Blog MS Shop</title>
</svelte:head>

<Breadcrumb items={[{ label: 'Blog', href: '/blog' }, { label: data.current.name }]} />

<h1
	class="font-display text-[28px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[38px]"
>
	{data.current.name}
</h1>

<nav class="mt-6 flex flex-wrap gap-2" aria-label="Catégories du blog">
	<a
		href="/blog"
		class="border-[1.5px] border-shop-border bg-white px-3 py-1.5 font-display text-[13px] font-bold text-shop-ink hover:border-shop-ink"
	>
		Tous les articles
	</a>
	{#each data.categories as category (category.slug)}
		{@const active = category.slug === data.current.slug}
		<a
			href="/blog/categorie/{category.slug}"
			aria-current={active ? 'page' : undefined}
			class="border-[1.5px] px-3 py-1.5 font-display text-[13px] font-bold {active
				? 'border-shop-ink bg-shop-ink text-white'
				: 'border-shop-border bg-white text-shop-ink hover:border-shop-ink'}"
		>
			{category.name}
			<span class={active ? 'text-white/70' : 'text-shop-muted'}>({category.articleCount})</span>
		</a>
	{/each}
</nav>

{#if data.articles.length === 0}
	<Panel class="mt-8 px-6 py-12 text-center">
		<p class="text-shop-muted">Aucun article dans cette catégorie pour le moment.</p>
	</Panel>
{:else}
	<div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.articles as article (article.slug)}
			<ArticleCard {article} />
		{/each}
	</div>
{/if}

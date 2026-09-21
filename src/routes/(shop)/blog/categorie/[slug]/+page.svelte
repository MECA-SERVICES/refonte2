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

<!-- Le fil reprend toute la lignée : une sous-catégorie situe son parent. -->
<Breadcrumb
	items={[
		{ label: 'Blog', href: '/blog' },
		...data.trail.map((c, i) => ({
			label: c.name,
			href: i < data.trail.length - 1 ? `/blog/categorie/${c.slug}` : undefined
		}))
	]}
/>

<h1
	class="font-display text-[28px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[38px]"
>
	{data.current.name}
</h1>

{#if data.current.description}
	<p class="mt-3 max-w-2xl text-shop-muted">{data.current.description}</p>
{/if}

<nav class="mt-6 flex flex-wrap gap-2" aria-label="Catégories du blog">
	<a
		href="/blog"
		class="border-[1.5px] border-shop-border bg-white px-3 py-1.5 font-display text-[13px] font-bold text-shop-ink hover:border-shop-ink"
	>
		Tous les articles
	</a>
	<!-- Navigation principale : les catégories de premier niveau. -->
	{#each data.roots as category (category.slug)}
		{@const active = data.trail.some((c) => c.slug === category.slug)}
		<a
			href="/blog/categorie/{category.slug}"
			aria-current={category.slug === data.current.slug ? 'page' : undefined}
			class="border-[1.5px] px-3 py-1.5 font-display text-[13px] font-bold {active
				? 'border-shop-ink bg-shop-ink text-white'
				: 'border-shop-border bg-white text-shop-ink hover:border-shop-ink'}"
		>
			{category.name}
		</a>
	{/each}
</nav>

{#if data.children.length > 0}
	<!--
		Second rang : les sous-catégories de la branche ouverte. « Tout » ramène
		au parent, dont la page couvre déjà toute la descendance.
	-->
	<nav class="mt-3 flex flex-wrap gap-2" aria-label="Sous-catégories de {data.current.name}">
		<a
			href="/blog/categorie/{data.current.slug}"
			aria-current="page"
			class="border-[1.5px] border-shop-ink bg-shop-ink px-3 py-1.5 font-display text-[13px] font-bold text-white"
		>
			Tout {data.current.name}
			<span class="text-white/70">({data.articles.length})</span>
		</a>
		{#each data.children as child (child.slug)}
			<a
				href="/blog/categorie/{child.slug}"
				class="border-[1.5px] border-shop-border bg-white px-3 py-1.5 font-display text-[13px] font-bold text-shop-ink hover:border-shop-ink"
			>
				{child.name}
				<span class="text-shop-muted">({child.articleCount})</span>
			</a>
		{/each}
	</nav>
{/if}

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

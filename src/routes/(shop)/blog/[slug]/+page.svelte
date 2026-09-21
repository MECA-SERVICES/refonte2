<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const article = $derived(data.article);
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
</script>

<svelte:head>
	<title>{article.metaTitle ?? article.title} — MS Shop</title>
	{#if article.metaDescription ?? article.excerpt}
		<meta name="description" content={article.metaDescription ?? article.excerpt} />
	{/if}
	<!-- Un aperçu de brouillon ne doit jamais être indexé (R13). -->
	{#if data.isPreview}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<Breadcrumb
	items={[
		{ label: 'Blog', href: '/blog' },
		...(data.categoryName && data.categorySlug
			? [{ label: data.categoryName, href: `/blog/categorie/${data.categorySlug}` }]
			: []),
		{ label: article.title }
	]}
/>

{#if data.isPreview}
	<p
		class="mb-5 border-[1.5px] border-shop-orange bg-white px-4 py-3 text-sm font-medium text-shop-ink"
	>
		Aperçu d'un brouillon — cet article n'est pas publié et n'est pas référencé.
	</p>
{/if}

<article class="mx-auto max-w-[70ch] pb-10">
	{#if article.coverImageUrl}
		<img
			src={article.coverImageUrl}
			alt=""
			class="mb-6 max-h-96 w-full border-[1.5px] border-shop-border object-cover"
		/>
	{/if}

	<h1
		class="font-display text-[28px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[38px]"
	>
		{article.title}
	</h1>

	<p class="mt-2 text-[13.5px] text-shop-muted">
		{#if article.publishedAt}{dateFmt.format(new Date(article.publishedAt))}{/if}
		{#if data.authorName}
			· {data.authorName}{/if}
	</p>

	{#if article.contentType === 'video' && article.videoUrl}
		<div class="mt-6 aspect-video w-full border-[1.5px] border-shop-border">
			<iframe
				src={article.videoUrl}
				title={article.title}
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
				allowfullscreen
				class="h-full w-full"
			></iframe>
		</div>
	{/if}

	{#if article.content}
		<!-- Même classe que l'éditeur : le rédacteur voit ce qui sera publié. -->
		<div class="format mt-6 max-w-none format-blue">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
			{@html article.content}
		</div>
	{/if}
</article>

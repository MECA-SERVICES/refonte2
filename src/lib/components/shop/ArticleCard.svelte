<script lang="ts">
	import ImagePlaceholder from './ImagePlaceholder.svelte';

	/** Vignette d'un article dans la liste du blog. */

	let {
		article
	}: {
		article: {
			slug: string;
			title: string;
			excerpt: string | null;
			coverImageUrl: string | null;
			contentType: string;
			externalUrl: string | null;
			publishedAt: Date | null;
			categoryName: string | null;
			categoryColor: string | null;
			authorName: string | null;
		};
	} = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	/** Un lien externe mène directement à sa destination. */
	const href = $derived(
		article.contentType === 'external_link' && article.externalUrl
			? article.externalUrl
			: `/blog/${article.slug}`
	);

	const isExternal = $derived(article.contentType === 'external_link');
</script>

<article class="flex h-full flex-col border-[1.5px] border-shop-border bg-white">
	<a
		{href}
		target={isExternal ? '_blank' : undefined}
		rel={isExternal ? 'noopener' : undefined}
		class="block"
	>
		{#if article.coverImageUrl}
			<img src={article.coverImageUrl} alt="" loading="lazy" class="h-44 w-full object-cover" />
		{:else}
			<ImagePlaceholder label={article.title} class="h-44 border-0" />
		{/if}
	</a>

	<div class="flex flex-1 flex-col p-4">
		<div class="mb-2 flex flex-wrap items-center gap-2">
			{#if article.categoryName}
				<span
					class="px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase"
					style="background-color: {article.categoryColor ?? '#314192'}"
				>
					{article.categoryName}
				</span>
			{/if}
			{#if article.contentType === 'video'}
				<span class="text-[11px] font-bold tracking-wide text-shop-muted uppercase">Vidéo</span>
			{:else if isExternal}
				<span class="text-[11px] font-bold tracking-wide text-shop-muted uppercase">Lien</span>
			{/if}
		</div>

		<h2 class="font-display text-[17px] font-extrabold tracking-[-0.015em] text-shop-ink">
			<a
				{href}
				target={isExternal ? '_blank' : undefined}
				rel={isExternal ? 'noopener' : undefined}
				class="hover:text-shop-blue"
			>
				{article.title}
			</a>
		</h2>

		{#if article.excerpt}
			<p class="mt-2 line-clamp-3 text-[14px] leading-relaxed text-shop-ink-soft">
				{article.excerpt}
			</p>
		{/if}

		<p class="mt-auto pt-3 text-[12.5px] text-shop-muted">
			{#if article.publishedAt}{dateFmt.format(new Date(article.publishedAt))}{/if}
			{#if article.authorName}
				· {article.authorName}{/if}
		</p>
	</div>
</article>

<script lang="ts">
	import ImagePlaceholder from './ImagePlaceholder.svelte';

	/** Vignette d'un article dans les listes du blog et sur l'accueil. */

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

<article
	class="relative flex h-full flex-col overflow-hidden rounded-[14px] border-[1.5px] border-shop-border-soft bg-white transition-[border-color,box-shadow] hover:border-primary-200 hover:shadow-[0_10px_30px_rgba(30,36,54,0.08)]"
>
	<div class="relative">
		{#if article.coverImageUrl}
			<img
				src={article.coverImageUrl}
				alt=""
				loading="lazy"
				class="h-[190px] w-full object-cover"
			/>
		{:else}
			<ImagePlaceholder label={article.title} class="h-[190px] border-0" />
		{/if}

		{#if article.contentType === 'video'}
			<span
				class="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-shop-ink/85 px-2.5 py-1 font-display text-xs font-bold text-white"
			>
				▶ Vidéo
			</span>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-2 p-4">
		<p class="min-h-4 text-[11.5px] font-bold tracking-[0.1em] text-shop-blue uppercase">
			{#if article.categoryName}{article.categoryName}{/if}
			{#if isExternal}<span class="text-shop-faint normal-case">· Lien externe</span>{/if}
		</p>

		<h2 class="font-display text-[17px] leading-[1.3] font-bold text-shop-ink">
			<!-- `after:absolute after:inset-0` étend la zone cliquable à toute la carte. -->
			<a
				{href}
				target={isExternal ? '_blank' : undefined}
				rel={isExternal ? 'noopener' : undefined}
				class="line-clamp-2 block after:absolute after:inset-0 after:content-[''] hover:text-shop-blue"
			>
				{article.title}
			</a>
		</h2>

		{#if article.excerpt}
			<p class="line-clamp-3 text-sm leading-normal text-shop-muted">
				{article.excerpt}
			</p>
		{/if}

		<p class="mt-auto pt-1.5 text-[12.5px] text-shop-faint">
			{#if article.publishedAt}{dateFmt.format(new Date(article.publishedAt))}{/if}
			{#if article.authorName}
				· {article.authorName}{/if}
		</p>
	</div>
</article>

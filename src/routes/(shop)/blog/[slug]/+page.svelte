<script lang="ts">
	import { page } from '$app/state';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const article = $derived(data.article);
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	/**
	 * Une URL YouTube collée depuis le navigateur (watch, youtu.be) ne se lit
	 * pas dans une iframe : on la ramène au format /embed/, en version
	 * no-cookie. Toute autre URL passe telle quelle.
	 */
	function embedUrl(url: string) {
		const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
		return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : url;
	}

	/** Confirmation brève après la copie du lien de partage. */
	let linkCopied = $state(false);
	async function copyLink() {
		await navigator.clipboard.writeText(page.url.href);
		linkCopied = true;
		setTimeout(() => (linkCopied = false), 1800);
	}

	const shareUrl = $derived(encodeURIComponent(page.url.href));
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
		class="mb-5 rounded-[10px] border-[1.5px] border-shop-orange bg-white px-4 py-3 text-sm font-medium text-shop-ink"
	>
		Aperçu d'un brouillon — cet article n'est pas publié et n'est pas référencé.
	</p>
{/if}

<!-- ================= Héro ================= -->
<div class="relative h-[340px] overflow-hidden rounded-[20px] bg-shop-ink sm:h-[440px]">
	{#if article.coverImageUrl}
		<img src={article.coverImageUrl} alt="" class="h-full w-full object-cover" />
	{:else}
		<ImagePlaceholder label={article.title} class="border-0 bg-shop-blue-dark text-shop-on-dark" />
	{/if}
	<div
		class="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-30% to-[rgba(20,26,58,0.92)]"
	></div>

	<div class="absolute inset-x-0 bottom-0 max-w-[900px] p-6 text-white sm:p-10">
		<div class="mb-3.5 flex flex-wrap gap-2">
			{#if data.categoryName}
				<span
					class="rounded-full bg-shop-blue px-3 py-1.5 font-display text-xs font-extrabold tracking-[0.08em] uppercase"
				>
					{data.categoryName}
				</span>
			{/if}
			{#if article.contentType === 'video'}
				<span
					class="rounded-full bg-shop-orange px-3 py-1.5 font-display text-xs font-extrabold tracking-[0.08em] uppercase"
				>
					▶ Tuto vidéo
				</span>
			{/if}
		</div>
		<h1
			class="font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.025em] text-balance sm:text-[38px] lg:text-[44px]"
		>
			{article.title}
		</h1>
		<p class="mt-3 text-sm text-shop-on-dark">
			{#if article.publishedAt}{dateFmt.format(new Date(article.publishedAt))}{/if}
			{#if data.authorName}
				· {data.authorName}{/if}
		</p>
	</div>
</div>

<!-- ================= Corps & colonne latérale ================= -->
<div class="mt-9 grid items-start gap-10 pb-10 lg:grid-cols-[minmax(0,1fr)_340px]">
	<article class="max-w-[72ch] min-w-0">
		{#if article.excerpt}
			<p class="mb-6 text-[19px] leading-relaxed font-medium text-pretty text-shop-ink-soft">
				{article.excerpt}
			</p>
		{/if}

		{#if article.contentType === 'video' && article.videoUrl}
			<div class="mb-7 aspect-video w-full overflow-hidden rounded-[14px] bg-shop-ink">
				<iframe
					src={embedUrl(article.videoUrl)}
					title={article.title}
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
					allowfullscreen
					class="h-full w-full"
				></iframe>
			</div>
		{/if}

		{#if article.content}
			<!-- Même classe que l'éditeur : le rédacteur voit ce qui sera publié. -->
			<div class="format max-w-none format-blue">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
				{@html article.content}
			</div>
		{/if}

		<!-- Partage : discret, en pied d'article. -->
		<div
			class="mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 border-t-[1.5px] border-shop-border-soft pt-5 text-[13.5px] text-shop-muted"
		>
			<span>Partager :</span>
			<a
				href="https://www.facebook.com/sharer/sharer.php?u={shareUrl}"
				target="_blank"
				rel="noopener"
				class="font-bold text-shop-blue hover:underline"
			>
				Facebook
			</a>
			<a
				href="mailto:?subject={encodeURIComponent(article.title)}&body={shareUrl}"
				class="font-bold text-shop-blue hover:underline"
			>
				E-mail
			</a>
			<button type="button" onclick={copyLink} class="font-bold text-shop-blue hover:underline">
				{linkCopied ? 'Lien copié ✓' : 'Copier le lien'}
			</button>
		</div>
	</article>

	<!-- L'en-tête collant mesure ~150 px : le décalage l'évite. -->
	<aside class="flex min-w-0 flex-col gap-6 lg:sticky lg:top-40">
		<div class="rounded-2xl bg-shop-blue p-6 text-white">
			<p class="font-display text-lg font-extrabold tracking-[-0.01em]">
				Besoin d'un coup de main ?
			</p>
			<p class="mt-1.5 mb-3.5 text-sm leading-relaxed text-[#e2e7f6]">
				L'atelier de Carantilly répond du lundi au vendredi. Envoyez une photo de la plaque
				constructeur, on identifie la pièce.
			</p>
			<a href="tel:0950922336" class="block font-display text-[22px] font-extrabold text-white">
				09 50 92 23 36
			</a>
		</div>

		{#if data.related.length > 0}
			<div>
				<p
					class="mb-3 font-display text-[12.5px] font-extrabold tracking-[0.12em] text-shop-muted uppercase"
				>
					Articles similaires
				</p>
				<div class="flex flex-col gap-2.5">
					{#each data.related as rel (rel.slug)}
						{@const relExternal = rel.contentType === 'external_link' && rel.externalUrl}
						<a
							href={relExternal ? rel.externalUrl : `/blog/${rel.slug}`}
							target={relExternal ? '_blank' : undefined}
							rel={relExternal ? 'noopener' : undefined}
							class="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 rounded-xl border-[1.5px] border-shop-border-soft bg-white p-2 transition-colors hover:border-shop-blue"
						>
							<div class="h-[84px] w-[110px] overflow-hidden rounded-[10px] bg-shop-subtle">
								{#if rel.coverImageUrl}
									<img
										src={rel.coverImageUrl}
										alt=""
										loading="lazy"
										class="h-full w-full object-cover"
									/>
								{:else}
									<ImagePlaceholder label="Photo" class="border-0" />
								{/if}
							</div>
							<div class="min-w-0">
								{#if rel.categoryName}
									<p class="text-[11px] font-bold tracking-[0.1em] text-shop-blue uppercase">
										{rel.categoryName}
									</p>
								{/if}
								<p
									class="line-clamp-2 font-display text-[13.5px] leading-[1.3] font-bold text-shop-ink"
								>
									{rel.title}
								</p>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</aside>
</div>

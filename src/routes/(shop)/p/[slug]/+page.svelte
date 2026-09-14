<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const page = $derived(data.page);
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
</script>

<svelte:head>
	<title>{page.metaTitle ?? page.title} — MS Shop</title>
	{#if page.metaDescription}
		<meta name="description" content={page.metaDescription} />
	{/if}
</svelte:head>

<Breadcrumb items={[{ label: page.title }]} />

<article class="mx-auto max-w-[70ch] pb-10">
	<h1
		class="font-display text-[28px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[38px]"
	>
		{page.title}
	</h1>

	<!-- `format` est la classe employée par l'éditeur : la page publique rend donc
	     exactement ce que le rédacteur voyait en la composant. -->
	<div class="format mt-6 max-w-none format-blue">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
		{@html page.content}
	</div>

	<p class="mt-10 border-t-[1.5px] border-shop-border-soft pt-4 text-[13px] text-shop-muted">
		Dernière mise à jour le {dateFmt.format(new Date(page.updatedAt))}
	</p>
</article>

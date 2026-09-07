<script lang="ts">
	import ImagePlaceholder from './ImagePlaceholder.svelte';

	/** Carte d'univers : un visuel, un titre, une précision. */

	let {
		title,
		subtitle,
		href,
		image = null,
		imageLabel
	}: {
		title: string;
		subtitle: string;
		href: string;
		image?: string | null;
		/** Description du visuel attendu tant qu'aucune photo n'est fournie. */
		imageLabel: string;
	} = $props();
</script>

<a
	{href}
	class="block border-[1.5px] border-shop-border bg-white transition-colors hover:border-shop-ink"
>
	{#if image}
		<img src={image} alt={title} loading="lazy" class="h-[132px] w-full object-cover" />
	{:else}
		<ImagePlaceholder label={imageLabel} class="h-[132px] rounded-none border-0 border-b" />
	{/if}
	<div class="px-4 pt-3.5 pb-4">
		<p class="font-display text-base font-bold text-shop-ink">{title}</p>
		<p class="mt-1 text-[13px] text-shop-muted">{subtitle}</p>
	</div>
</a>

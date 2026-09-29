<script lang="ts">
	import ImagePlaceholder from './ImagePlaceholder.svelte';

	/**
	 * Carte d'univers de la charte v2 : visuel plein cadre sur fond sombre,
	 * dégradé de lisibilité en pied, titre et pilule d'action par-dessus.
	 */

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
	class="group relative block h-[280px] overflow-hidden rounded-2xl bg-shop-ink text-white sm:h-[320px]"
>
	{#if image}
		<img src={image} alt={title} loading="lazy" class="h-full w-full object-cover" />
	{:else}
		<ImagePlaceholder label={imageLabel} class="border-0" />
	{/if}

	<div
		class="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-35% to-shop-ink/90"
	></div>

	<div class="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-6">
		<p class="font-display text-[22px] font-extrabold tracking-[-0.02em] sm:text-[26px]">{title}</p>
		<p class="mt-1 text-[14.5px] text-shop-on-dark">{subtitle}</p>
		<span
			class="mt-3.5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-display text-[13px] font-bold text-shop-ink transition-colors group-hover:bg-primary-100"
		>
			Découvrir <span aria-hidden="true">→</span>
		</span>
	</div>
</a>

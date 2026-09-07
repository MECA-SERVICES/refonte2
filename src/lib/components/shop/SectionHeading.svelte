<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Titre de section de la maquette : un mot mis en valeur en orange, une
	 * accroche facultative, et un lien d'action aligné à droite.
	 */

	let {
		title,
		accent,
		lead,
		href,
		linkLabel = 'Tout le catalogue',
		children
	}: {
		title: string;
		/** Mot placé après le titre, en orange (signal commercial de la charte). */
		accent?: string;
		lead?: string;
		href?: string;
		linkLabel?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="mb-5 flex flex-wrap items-baseline justify-between gap-3">
	<div>
		<h2 class="font-display text-2xl font-extrabold tracking-tight text-shop-ink sm:text-[28px]">
			{title}
			{#if accent}<span class="text-shop-orange">{accent}</span>{/if}
		</h2>
		{#if lead}
			<p class="mt-1.5 text-[15px] text-shop-muted">{lead}</p>
		{/if}
	</div>

	{#if href}
		<a {href} class="text-sm font-bold text-shop-blue hover:underline">{linkLabel} →</a>
	{:else if children}
		{@render children()}
	{/if}
</div>

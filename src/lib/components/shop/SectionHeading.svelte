<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Titre de section de la maquette v2 : un mot mis en valeur en bleu de
	 * marque, une accroche facultative, et un lien d'action aligné à droite.
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
		/** Mot placé après le titre, en bleu de marque. */
		accent?: string;
		lead?: string;
		href?: string;
		linkLabel?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="mb-5 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
	<div>
		<h2
			class="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[28px] lg:text-[32px]"
		>
			{title}
			{#if accent}<span class="text-shop-blue">{accent}</span>{/if}
		</h2>
		{#if lead}
			<p class="mt-1.5 text-[15.5px] text-shop-muted">{lead}</p>
		{/if}
	</div>

	{#if href}
		<a {href} class="text-sm font-bold text-shop-blue hover:underline">{linkLabel} →</a>
	{:else if children}
		{@render children()}
	{/if}
</div>

<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Titre de la charte : Archivo, capitales, graisse extra.
	 *
	 * Six tailles couvrent les usages recensés — du libellé de colonne au titre
	 * de page — pour éviter que chaque écran ne réinvente son échelle.
	 */

	type Level = 'h1' | 'h2' | 'h3' | 'p';
	type Size = 'page' | 'section' | 'block' | 'card' | 'label' | 'eyebrow';

	let {
		as = 'h2',
		size = 'section',
		class: className = '',
		children
	}: {
		as?: Level;
		size?: Size;
		class?: string;
		children: Snippet;
	} = $props();

	const sizes: Record<Size, string> = {
		page: 'text-[28px] font-extrabold tracking-[-0.025em] sm:text-[34px]',
		section: 'text-2xl font-extrabold tracking-[-0.02em] sm:text-[28px]',
		block: 'text-xl font-extrabold tracking-wide uppercase',
		card: 'text-base font-extrabold tracking-wide uppercase',
		label: 'text-sm font-bold tracking-wide uppercase',
		eyebrow: 'text-[13px] font-extrabold tracking-[0.1em] uppercase'
	};

	const classes = $derived(`font-display text-shop-ink ${sizes[size]} ${className}`);
</script>

<svelte:element this={as} class={classes}>{@render children()}</svelte:element>

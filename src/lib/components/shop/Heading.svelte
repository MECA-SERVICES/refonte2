<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Titre de la charte v2 : Archivo, graisse extra, interlettrage resserré.
	 * Seuls `label` et `eyebrow` restent en capitales (libellés de colonnes).
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
		page: 'text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] sm:text-[38px] lg:text-[44px]',
		section:
			'text-2xl leading-tight font-extrabold tracking-[-0.02em] sm:text-[28px] lg:text-[32px]',
		block: 'text-[22px] leading-tight font-extrabold tracking-[-0.015em]',
		card: 'text-[17px] leading-snug font-extrabold tracking-[-0.01em]',
		label: 'text-sm font-bold tracking-wide uppercase',
		eyebrow: 'text-[12.5px] font-extrabold tracking-[0.12em] uppercase'
	};

	const classes = $derived(`font-display text-shop-ink ${sizes[size]} ${className}`);
</script>

<svelte:element this={as} class={classes}>{@render children()}</svelte:element>

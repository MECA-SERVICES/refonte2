<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * Bouton de la boutique.
	 *
	 * Flowbite impose ses propres rayons et sa palette `primary` ; la charte
	 * MS Shop est carrée et repose sur les rôles de couleur `shop-*` (rouge =
	 * achat, bleu = navigation). Plutôt que de neutraliser le thème Flowbite à
	 * chaque appel, ce composant porte les quatre variantes du design.
	 *
	 * Il rend un `<a>` dès qu'un `href` est fourni, un `<button>` sinon.
	 */

	type Variant = 'buy' | 'primary' | 'outline' | 'secondary';
	type Size = 'sm' | 'md' | 'lg';

	let {
		variant = 'primary',
		size = 'md',
		href,
		block = false,
		class: className = '',
		children,
		...rest
	}: {
		/** `buy` = achat (rouge), `primary` = navigation (bleu), `outline`/`secondary` = bordés. */
		variant?: Variant;
		size?: Size;
		href?: string;
		/** Occupe toute la largeur disponible. */
		block?: boolean;
		class?: string;
		children: Snippet;
	} & (HTMLButtonAttributes | HTMLAnchorAttributes) = $props();

	const base =
		'inline-flex items-center justify-center gap-2 font-display font-bold text-center transition-colors disabled:cursor-not-allowed disabled:bg-shop-border disabled:text-shop-muted disabled:border-shop-border';

	const variants: Record<Variant, string> = {
		buy: 'bg-shop-red text-white hover:bg-shop-red-dark',
		primary: 'bg-shop-blue text-white hover:bg-shop-blue-dark',
		outline: 'border-[1.5px] border-shop-ink bg-white text-shop-ink hover:bg-shop-subtle',
		secondary:
			'border-[1.5px] border-shop-border bg-white text-shop-ink hover:border-shop-ink font-medium'
	};

	const sizes: Record<Size, string> = {
		sm: 'px-3.5 py-2.5 text-sm',
		md: 'px-5 py-3 text-[15px]',
		lg: 'px-6 py-3.5 text-base'
	};

	const classes = $derived(
		[base, variants[variant], sizes[size], block && 'w-full', className].filter(Boolean).join(' ')
	);
</script>

{#if href}
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>
		{@render children()}
	</a>
{:else}
	<button class={classes} {...rest as HTMLButtonAttributes}>
		{@render children()}
	</button>
{/if}

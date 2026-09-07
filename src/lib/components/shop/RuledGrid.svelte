<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Grille « à filets » de la maquette : les cellules sont séparées par un
	 * trait unique, obtenu par un fond bordure et un écart d'un pixel — pas de
	 * bordure par cellule, donc pas de double trait aux jonctions.
	 */

	let {
		minWidth = '220px',
		children
	}: {
		/** Largeur minimale d'une cellule avant passage à la ligne. */
		minWidth?: string;
		children: Snippet;
	} = $props();
</script>

<div
	class="grid gap-px border border-shop-border bg-shop-border"
	style="grid-template-columns: repeat(auto-fit, minmax({minWidth}, 1fr));"
>
	{@render children()}
</div>

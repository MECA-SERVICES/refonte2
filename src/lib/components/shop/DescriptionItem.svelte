<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Couple libellé / valeur d'une fiche descriptive.
	 *
	 * Le motif « intitulé en petites capitales grises, valeur en gras » revient
	 * sur toutes les fiches (compte, produit, commande) : le regrouper évite de
	 * réécrire les mêmes classes à chaque champ.
	 */

	let {
		label,
		children
	}: {
		label: string;
		children: Snippet;
	} = $props();
</script>

<div>
	<dt class="text-[11.5px] font-bold tracking-[0.1em] text-shop-muted uppercase">{label}</dt>
	<dd class="mt-1 text-[15px] font-medium break-words text-shop-ink">{@render children()}</dd>
</div>

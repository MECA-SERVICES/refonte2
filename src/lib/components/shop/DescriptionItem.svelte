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
	<dt class="text-xs tracking-wide text-shop-muted uppercase">{label}</dt>
	<dd class="mt-0.5 font-semibold break-words text-shop-ink">{@render children()}</dd>
</div>

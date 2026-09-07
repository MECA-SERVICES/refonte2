<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Ligne d'un récapitulatif : intitulé à gauche, montant à droite. */

	let {
		label,
		muted = false,
		children
	}: {
		label: string;
		/** Valeur secondaire (mention de délai, estimation) plutôt qu'un montant. */
		muted?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="flex justify-between gap-3 py-1.5">
	<dt>{label}</dt>
	<dd class={muted ? 'text-shop-muted' : 'font-bold text-shop-ink'}>{@render children()}</dd>
</div>

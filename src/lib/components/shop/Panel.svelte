<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Bloc encadré de la charte v2 : trait de 1,5 px, angles arrondis à 16 px.
	 *
	 * Flowbite `Card` impose une ombre et son propre espacement ; ce motif
	 * revient près de 40 fois dans la boutique, d'où ce conteneur unique.
	 */

	type Tone = 'default' | 'strong' | 'subtle';

	let {
		tone = 'default',
		padded = true,
		class: className = '',
		children
	}: {
		/** `strong` = bordure foncée (blocs d'achat), `subtle` = fond gris. */
		tone?: Tone;
		/** Espacement intérieur standard ; à couper pour les listes à filets. */
		padded?: boolean;
		class?: string;
		children: Snippet;
	} = $props();

	const tones: Record<Tone, string> = {
		default: 'border-shop-border-soft bg-white',
		strong: 'border-shop-border bg-white',
		subtle: 'border-shop-border-soft bg-shop-subtle'
	};
</script>

<div class="rounded-2xl border-[1.5px] {tones[tone]} {padded ? 'p-5' : ''} {className}">
	{@render children()}
</div>

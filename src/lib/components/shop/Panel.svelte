<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Bloc encadré de la charte : trait de 1,5 px, angles droits.
	 *
	 * Flowbite `Card` impose un rayon, une ombre et son propre espacement ;
	 * le motif carré de la maquette revient près de 40 fois dans la boutique,
	 * d'où ce conteneur unique.
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
		default: 'border-shop-border bg-white',
		strong: 'border-shop-ink bg-white',
		subtle: 'border-shop-border bg-shop-subtle'
	};
</script>

<div class="border-[1.5px] {tones[tone]} {padded ? 'p-5' : ''} {className}">
	{@render children()}
</div>

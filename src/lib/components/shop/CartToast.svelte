<script lang="ts">
	import { CheckCircleSolid, CloseOutline } from 'flowbite-svelte-icons';
	import { fly } from 'svelte/transition';

	/**
	 * Confirmation d'ajout au panier.
	 *
	 * Composant dédié plutôt que le `Toast` de Flowbite, pour trois raisons de
	 * fond — la bibliothèque impose :
	 *   - `position: absolute`, qui ancre le bandeau au conteneur et non à la
	 *     fenêtre : il disparaîtrait au défilement ;
	 *   - `max-w-xs` et `rounded-lg`, alors que la charte est carrée et que le
	 *     message porte le nom complet d'un produit ;
	 *   - un fond blanc et une palette claire, quand la charte veut un aplat
	 *     sombre `shop-ink`.
	 *
	 * Neutraliser ces trois points revenait à réécrire le composant : autant
	 * l'assumer ici, en gardant les icônes Flowbite et la transition de Svelte.
	 */

	let {
		message = $bindable(null),
		durationMs = 4000
	}: {
		/** Texte à afficher ; `null` masque le bandeau. */
		message?: string | null;
		durationMs?: number;
	} = $props();

	$effect(() => {
		if (!message) return;
		const timer = setTimeout(() => (message = null), durationMs);
		return () => clearTimeout(timer);
	});
</script>

{#if message}
	<div
		class="fixed bottom-6 left-6 z-[70] flex max-w-md items-center gap-3 border-[1.5px] border-shop-ink bg-shop-ink px-4 py-3 text-shop-subtle shadow-xl"
		role="status"
		aria-live="polite"
		transition:fly={{ y: 24, duration: 220 }}
	>
		<CheckCircleSolid class="h-5 w-5 shrink-0 text-green-400" />

		<span class="min-w-0 flex-1 text-sm font-medium">{message}</span>

		<a
			href="/panier"
			class="shrink-0 font-display text-sm font-bold text-white underline underline-offset-2 hover:text-shop-on-dark"
		>
			Voir le panier
		</a>

		<button
			type="button"
			onclick={() => (message = null)}
			aria-label="Fermer"
			class="shrink-0 text-shop-on-dark-dim transition-colors hover:text-white"
		>
			<CloseOutline class="h-4 w-4" />
		</button>
	</div>
{/if}

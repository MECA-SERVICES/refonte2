<script lang="ts">
	import { CheckCircleSolid, CloseOutline } from 'flowbite-svelte-icons';
	import { fly } from 'svelte/transition';

	/**
	 * Confirmation d'ajout au panier.
	 *
	 * Un bandeau sombre glisse depuis le bas de l'écran : le motif retenu par
	 * les grands catalogues, parce qu'il confirme sans interrompre — la page ne
	 * bouge pas, on peut continuer à parcourir la liste.
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
		class="fixed bottom-6 left-6 z-[70] flex max-w-sm items-center gap-3 bg-shop-ink px-4 py-3 text-shop-subtle shadow-xl"
		role="status"
		aria-live="polite"
		transition:fly={{ y: 24, duration: 220 }}
	>
		<CheckCircleSolid class="h-5 w-5 shrink-0 text-green-400" />
		<span class="text-sm font-medium">{message}</span>
		<a
			href="/panier"
			class="ms-1 shrink-0 font-display text-sm font-bold text-white underline underline-offset-2"
		>
			Voir
		</a>
		<button
			type="button"
			onclick={() => (message = null)}
			aria-label="Fermer"
			class="ms-1 shrink-0 text-shop-on-dark-dim hover:text-white"
		>
			<CloseOutline class="h-4 w-4" />
		</button>
	</div>
{/if}

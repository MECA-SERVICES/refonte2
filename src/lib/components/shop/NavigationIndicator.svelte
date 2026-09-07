<script lang="ts">
	import { navigating } from '$app/state';
	import { Spinner } from 'flowbite-svelte';

	/**
	 * Retour visuel pendant une navigation.
	 *
	 * Les pages de catalogue interrogent une base d'un million de références :
	 * même optimisées, elles demandent quelques centaines de millisecondes. Sans
	 * signal, le clic paraît sans effet et le visiteur le répète.
	 *
	 * Le délai avant affichage évite un clignotement sur les pages rapides : on
	 * ne montre le voile que si l'attente devient perceptible.
	 */

	let { delayMs = 250 }: { delayMs?: number } = $props();

	let visible = $state(false);

	$effect(() => {
		if (!navigating.to) {
			visible = false;
			return;
		}

		const timer = setTimeout(() => (visible = true), delayMs);
		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<!-- Bandeau de progression, sous l'en-tête collant -->
	<div class="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-shop-border">
		<div class="h-full w-1/3 animate-[loading_1.1s_ease-in-out_infinite] bg-shop-red"></div>
	</div>

	<!-- Pastille discrète : le contenu reste lisible pendant le chargement -->
	<div
		class="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 border-[1.5px] border-shop-ink bg-white px-4 py-2.5 shadow-lg"
		role="status"
		aria-live="polite"
	>
		<Spinner size="5" color="red" />
		<span class="font-display text-sm font-bold text-shop-ink">Chargement…</span>
	</div>
{/if}

<style>
	@keyframes loading {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}
</style>

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

	<!--
		Voile centré : un léger fond translucide isole l'indicateur du contenu,
		qui reste visible derrière. Placé au centre de l'écran, il est vu sans
		avoir à chercher — en bas de page, il passait inaperçu.
	-->
	<div
		class="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-shop-ink/10"
		role="status"
		aria-live="polite"
	>
		<div
			class="flex items-center gap-3 border-[1.5px] border-shop-ink bg-white px-6 py-4 shadow-xl"
		>
			<Spinner size="6" color="red" />
			<span class="font-display text-[15px] font-bold text-shop-ink">Chargement…</span>
		</div>
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

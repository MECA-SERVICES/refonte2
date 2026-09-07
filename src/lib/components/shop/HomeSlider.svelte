<script lang="ts">
	import { onMount } from 'svelte';
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import type { Slide } from './hero-slider';

	let {
		slides,
		intervalMs = 7000
	}: {
		slides: Slide[];
		/** Durée d'affichage d'une vue avant passage à la suivante. */
		intervalMs?: number;
	} = $props();

	let index = $state(0);
	/** Suspend le défilement au survol et pendant une interaction clavier. */
	let paused = $state(false);

	const goTo = (i: number) => (index = (i + slides.length) % slides.length);
	const next = () => goTo(index + 1);
	const previous = () => goTo(index - 1);

	onMount(() => {
		if (slides.length < 2) return;
		const timer = setInterval(() => {
			if (!paused) next();
		}, intervalMs);
		return () => clearInterval(timer);
	});
</script>

<!--
	Carrousel d'accueil : le visuel occupe toute la largeur, le message est porté
	par l'image elle-même. Tant que les photos ne sont pas fournies, un bloc
	d'attente indique le format attendu.
-->
<section
	class="relative overflow-hidden bg-shop-subtle"
	aria-roledescription="carrousel"
	aria-label="Mises en avant"
	onmouseenter={() => (paused = true)}
	onmouseleave={() => (paused = false)}
	onfocusin={() => (paused = true)}
	onfocusout={() => (paused = false)}
>
	{#each slides as slide, i (slide.imageLabel)}
		<div
			class={i === index ? 'block' : 'hidden'}
			role="group"
			aria-roledescription="diapositive"
			aria-label="{i + 1} sur {slides.length}"
		>
			<a href={slide.href} class="block aspect-[3/1] w-full">
				{#if slide.image}
					<img
						src={slide.image}
						alt={slide.imageLabel}
						class="h-full w-full object-cover"
						loading={i === 0 ? 'eager' : 'lazy'}
						fetchpriority={i === 0 ? 'high' : 'auto'}
					/>
				{:else}
					<ImagePlaceholder
						label={slide.imageLabel}
						hint={slide.imageHint}
						class="h-full rounded-none border-0 bg-transparent"
					/>
				{/if}
			</a>
		</div>
	{/each}

	{#if slides.length > 1}
		<!-- Pagination en pilule, comme un compteur : ‹ 1 / 3 › -->
		<div
			class="absolute right-6 bottom-5 flex items-center gap-1 border-[1.5px] border-shop-ink bg-white px-2 py-1 lg:right-8"
		>
			<button
				type="button"
				onclick={previous}
				aria-label="Diapositive précédente"
				class="flex h-7 w-7 items-center justify-center text-shop-muted transition hover:bg-shop-subtle hover:text-shop-ink"
			>
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2.5"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
			<span class="min-w-9 text-center text-sm font-semibold text-shop-ink">
				{index + 1} / {slides.length}
			</span>
			<button
				type="button"
				onclick={next}
				aria-label="Diapositive suivante"
				class="flex h-7 w-7 items-center justify-center text-shop-muted transition hover:bg-shop-subtle hover:text-shop-ink"
			>
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2.5"
						d="M9 5l7 7-7 7"
					/>
				</svg>
			</button>
		</div>
	{/if}
</section>

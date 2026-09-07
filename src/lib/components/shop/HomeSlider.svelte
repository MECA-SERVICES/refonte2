<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
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
	Carrousel d'accueil en deux volets : le message à gauche sur fond de marque,
	le visuel à droite. La composition tient avec ou sans photo — le volet image
	accueille un bloc d'attente tant que les visuels ne sont pas fournis.
-->
<section
	class="relative overflow-hidden rounded-2xl bg-primary-800"
	aria-roledescription="carrousel"
	aria-label="Mises en avant"
	onmouseenter={() => (paused = true)}
	onmouseleave={() => (paused = false)}
	onfocusin={() => (paused = true)}
	onfocusout={() => (paused = false)}
>
	{#each slides as slide, i (slide.title)}
		<div
			class="{i === index ? 'grid' : 'hidden'} lg:grid-cols-2"
			role="group"
			aria-roledescription="diapositive"
			aria-label="{i + 1} sur {slides.length}"
		>
			<!-- Volet message -->
			<div class="flex flex-col justify-center p-8 pb-16 text-white sm:p-10 lg:p-12 lg:pb-12">
				{#if slide.eyebrow}
					<span
						class="mb-4 inline-flex w-fit items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide uppercase"
					>
						{slide.eyebrow}
					</span>
				{/if}
				<h2 class="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
					{slide.title}
				</h2>
				{#if slide.text}
					<p class="mt-4 max-w-md text-sm text-primary-200 sm:text-base">{slide.text}</p>
				{/if}
				<div class="mt-7">
					<Button size="lg" href={slide.href} class="bg-white text-primary-800 hover:bg-primary-50">
						{slide.cta}
						<ArrowRightOutline class="ms-2 h-4 w-4" />
					</Button>
				</div>
			</div>

			<!-- Volet visuel -->
			<div class="relative min-h-[220px] p-4 lg:min-h-[380px] lg:p-5 lg:ps-0">
				{#if slide.image}
					<img
						src={slide.image}
						alt={slide.imageLabel}
						class="h-full w-full rounded-lg object-cover"
						loading={i === 0 ? 'eager' : 'lazy'}
						fetchpriority={i === 0 ? 'high' : 'auto'}
					/>
				{:else}
					<ImagePlaceholder label={slide.imageLabel} hint={slide.imageHint} />
				{/if}
			</div>
		</div>
	{/each}

	{#if slides.length > 1}
		<!-- Pastilles de position -->
		<div class="absolute bottom-5 left-8 flex gap-2 sm:left-10 lg:left-12">
			{#each slides as slide, i (slide.title)}
				<button
					type="button"
					onclick={() => goTo(i)}
					aria-label="Aller à la diapositive {i + 1}"
					aria-current={i === index}
					class="h-2 rounded-full transition-all {i === index
						? 'w-7 bg-white'
						: 'w-2 bg-white/40 hover:bg-white/70'}"
				></button>
			{/each}
		</div>

		<!-- Flèches -->
		<div class="absolute right-6 bottom-4 flex items-center gap-2">
			<button
				type="button"
				onclick={previous}
				aria-label="Diapositive précédente"
				class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
			>
				<svg
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
			<button
				type="button"
				onclick={next}
				aria-label="Diapositive suivante"
				class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
			>
				<svg
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	{/if}
</section>

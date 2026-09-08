<script lang="ts">
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import { formatPrice } from '$lib/shop';

	/**
	 * Carrousel promotionnel du hero.
	 *
	 * Chaque vue superpose au visuel un encart d'offre — badge, marque, produit,
	 * prix barré — et un lien d'accès. Les vues se croisent en fondu ; sous le
	 * cadre, des pastilles nommées par marque permettent d'aller directement à
	 * une offre, ce qu'un simple point ne permettrait pas.
	 */

	export type PromoSlide = {
		badge: string;
		brand: string;
		name: string;
		/** Prix de vente ; absent, l'offre est « sur devis ». */
		price?: number;
		/** Prix barré, affiché en « au lieu de… ». */
		was?: number;
		note: string;
		href: string;
		image?: string | null;
		/** Décrit le visuel attendu tant qu'aucune photo n'est fournie. */
		imageLabel: string;
	};

	let {
		slides,
		intervalMs = 7000,
		class: className = ''
	}: {
		slides: PromoSlide[];
		/** Durée d'affichage d'une vue ; 0 désactive le défilement. */
		intervalMs?: number;
		/** Permet à l'appelant d'imposer la hauteur du cadre. */
		class?: string;
	} = $props();

	let current = $state(0);
	/** Suspend le défilement au survol et pendant une navigation clavier. */
	let paused = $state(false);

	const go = (index: number) => (current = (index + slides.length) % slides.length);

	$effect(() => {
		if (slides.length < 2 || paused || intervalMs <= 0) return;
		const timer = setInterval(() => go(current + 1), intervalMs);
		return () => clearInterval(timer);
	});

	const arrowClass =
		'absolute top-1/2 z-10 flex h-14 w-10 -translate-y-1/2 items-center justify-center bg-shop-ink/70 text-lg text-white transition-colors hover:bg-shop-ink';
</script>

<div class="flex h-full flex-col {className}">
	<section
		class="relative min-h-[340px] flex-1 overflow-hidden border-[1.5px] border-shop-ink bg-shop-border-soft"
		aria-roledescription="carrousel"
		aria-label="Offres du moment"
		onmouseenter={() => (paused = true)}
		onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)}
		onfocusout={() => (paused = false)}
	>
		{#each slides as slide, i (slide.name)}
			<div
				class="absolute inset-0 transition-opacity duration-500 {i === current
					? 'opacity-100'
					: 'pointer-events-none opacity-0'}"
				role="group"
				aria-roledescription="diapositive"
				aria-label="{i + 1} sur {slides.length}"
				aria-hidden={i !== current}
			>
				{#if slide.image}
					<img
						src={slide.image}
						alt={slide.imageLabel}
						loading={i === 0 ? 'eager' : 'lazy'}
						class="h-full w-full object-cover"
					/>
				{:else}
					<ImagePlaceholder label={slide.imageLabel} class="border-0" />
				{/if}

				<!-- Encart d'offre : posé en haut à gauche, il ne masque pas le sujet. -->
				<div
					class="pointer-events-none absolute top-0 left-0 max-w-[74%] bg-white px-5 pt-4.5 pb-5"
				>
					<p
						class="mb-2.5 inline-block bg-shop-red px-2.5 py-1.5 font-display text-[11px] font-extrabold tracking-[0.12em] text-white uppercase"
					>
						{slide.badge}
					</p>
					<p class="text-xs font-bold tracking-[0.12em] text-shop-muted uppercase">{slide.brand}</p>
					<p
						class="mt-1.5 mb-2 font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-shop-ink sm:text-2xl"
					>
						{slide.name}
					</p>
					<div class="flex flex-wrap items-baseline gap-2.5">
						<span class="font-display text-2xl font-extrabold text-shop-red">
							{slide.price ? formatPrice(slide.price) : 'Sur devis'}
						</span>
						{#if slide.was}
							<span class="text-sm text-shop-muted line-through">
								au lieu de {formatPrice(slide.was)}
							</span>
						{/if}
						<span class="text-[13px] text-shop-muted">{slide.note}</span>
					</div>
				</div>

				<a
					href={slide.href}
					tabindex={i === current ? 0 : -1}
					class="absolute right-0 bottom-0 bg-shop-blue px-4.5 py-3.5 font-display text-sm font-bold text-white transition-colors hover:bg-shop-blue-dark"
				>
					Voir l'offre →
				</a>
			</div>
		{/each}

		{#if slides.length > 1}
			<button
				type="button"
				onclick={() => go(current - 1)}
				aria-label="Offre précédente"
				class="{arrowClass} left-0"
			>
				‹
			</button>
			<button
				type="button"
				onclick={() => go(current + 1)}
				aria-label="Offre suivante"
				class="{arrowClass} right-0"
			>
				›
			</button>
		{/if}
	</section>

	{#if slides.length > 1}
		<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
			<!-- Pastilles nommées : on choisit une offre, on ne devine pas un rang. -->
			<div class="flex flex-wrap gap-2">
				{#each slides as slide, i (slide.name)}
					<button
						type="button"
						onclick={() => go(i)}
						aria-current={i === current}
						class="border-[1.5px] px-2.5 py-1.5 font-display text-[12.5px] font-bold transition-colors {i ===
						current
							? 'border-shop-ink bg-shop-ink text-white'
							: 'border-shop-border bg-white text-shop-muted hover:border-shop-ink'}"
					>
						{i + 1} · {slide.brand}
					</button>
				{/each}
			</div>

			<a href="/recherche" class="font-display text-sm font-bold text-shop-blue hover:underline">
				Toutes les promos en cours →
			</a>
		</div>
	{/if}
</div>

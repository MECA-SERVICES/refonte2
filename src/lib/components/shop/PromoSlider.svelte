<script lang="ts">
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import { formatPrice } from '$lib/shop';

	/**
	 * Hero promotionnel de la charte v2 : visuel plein cadre sous un dégradé de
	 * lisibilité, offre posée à gauche (badge, titre, accroche, prix barré),
	 * contrôles regroupés en bas à gauche. Les vues se croisent en fondu.
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
		/** Vidéo d'ambiance (URL d'embed YouTube) ; prime sur `image`. */
		video?: string;
		/** Décrit le visuel attendu tant qu'aucune photo n'est fournie. */
		imageLabel: string;
		/** Libellé du bouton d'action ; « Voir l'offre » par défaut. */
		cta?: string;
	};

	let {
		slides,
		intervalMs = 7000,
		full = false,
		class: className = ''
	}: {
		slides: PromoSlide[];
		/** Durée d'affichage d'une vue ; 0 désactive le défilement. */
		intervalMs?: number;
		/** Pleine largeur d'écran : plus haut, sans arrondi. */
		full?: boolean;
		class?: string;
	} = $props();

	/** Une vue vidéo reste affichée plus longtemps qu'une photo. */
	const VIDEO_DWELL_MS = 15000;

	let current = $state(0);
	/** Suspend le défilement au survol et pendant une navigation clavier. */
	let paused = $state(false);

	const go = (index: number) => (current = (index + slides.length) % slides.length);

	$effect(() => {
		if (slides.length < 2 || paused || intervalMs <= 0) return;
		const dwell = slides[current]?.video ? VIDEO_DWELL_MS : intervalMs;
		const timer = setTimeout(() => go(current + 1), dwell);
		return () => clearTimeout(timer);
	});

	const arrowClass =
		'flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-white/50 bg-white/10 text-white transition-colors hover:bg-white hover:text-shop-ink';
</script>

<section
	class="relative overflow-hidden bg-shop-ink {full
		? 'h-[480px] sm:h-[580px]'
		: 'h-[440px] rounded-[20px] sm:h-[500px]'} {className}"
	aria-roledescription="carrousel"
	aria-label="Offres du moment"
	onmouseenter={() => (paused = true)}
	onmouseleave={() => (paused = false)}
	onfocusin={() => (paused = true)}
	onfocusout={() => (paused = false)}
>
	{#each slides as slide, i (slide.name)}
		<div
			class="absolute inset-0 transition-opacity duration-700 {i === current
				? 'opacity-100'
				: 'pointer-events-none opacity-0'}"
			role="group"
			aria-roledescription="diapositive"
			aria-label="{i + 1} sur {slides.length}"
			aria-hidden={i !== current}
		>
			{#if slide.video}
				<!-- La vidéo couvre le cadre comme un object-cover : centrée, au
				     moins aussi large et haute que lui, sans capter les clics. -->
				<iframe
					src={slide.video}
					title={slide.name}
					allow="autoplay; encrypted-media"
					class="pointer-events-none absolute top-1/2 left-1/2 aspect-video min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
				></iframe>
			{:else if slide.image}
				<img
					src={slide.image}
					alt={slide.imageLabel}
					loading={i === 0 ? 'eager' : 'lazy'}
					class="h-full w-full object-cover"
				/>
			{:else}
				<ImagePlaceholder label={slide.imageLabel} class="border-0 bg-shop-ink text-shop-on-dark" />
			{/if}

			<!-- Dégradé de lisibilité : le texte se pose sur la moitié gauche.
			     Plus léger sur une vidéo, déjà animée et lumineuse. -->
			<div
				class="pointer-events-none absolute inset-0 bg-gradient-to-r {slide.video
					? 'from-[rgba(20,26,58,0.68)] via-[rgba(20,26,58,0.38)] via-40% to-transparent'
					: 'from-[rgba(20,26,58,0.86)] via-[rgba(20,26,58,0.62)] via-40% to-[rgba(20,26,58,0.08)]'}"
			></div>

			<div
				class="absolute inset-y-0 left-0 flex max-w-[620px] flex-col justify-center p-7 pb-24 text-white sm:p-12 sm:pb-24"
			>
				<span
					class="self-start rounded-full bg-shop-orange px-3 py-1.5 font-display text-xs font-extrabold tracking-[0.1em] uppercase"
				>
					{slide.badge}
				</span>
				<h2
					class="mt-4 mb-3 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.025em] text-balance sm:text-[38px] lg:text-[46px]"
				>
					{slide.name}
				</h2>
				<p class="mb-6 max-w-[46ch] text-[16px] leading-normal text-pretty text-[#e2e7f6]">
					{slide.note}
				</p>
				<div class="flex flex-wrap items-center gap-2.5">
					<a
						href={slide.href}
						tabindex={i === current ? 0 : -1}
						class="rounded-[10px] bg-white px-5 py-3 font-display text-[15px] font-bold text-shop-ink transition-colors hover:bg-primary-100"
					>
						{slide.cta ?? "Voir l'offre"}
					</a>
					{#if slide.price}
						<span
							class="flex items-baseline gap-2 rounded-[10px] border-[1.5px] border-white/40 px-4 py-2.5"
						>
							<span class="font-display text-xl font-extrabold">{formatPrice(slide.price)}</span>
							{#if slide.was}
								<s class="text-sm text-shop-on-dark-dim">{formatPrice(slide.was)}</s>
							{/if}
						</span>
					{/if}
				</div>
			</div>
		</div>
	{/each}

	{#if slides.length > 1}
		<div class="absolute bottom-6 left-7 flex items-center gap-3.5 sm:left-12">
			<button
				type="button"
				onclick={() => go(current - 1)}
				aria-label="Offre précédente"
				class={arrowClass}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M15 5l-7 7 7 7" />
				</svg>
			</button>
			<div class="flex gap-2">
				{#each slides as slide, i (slide.name)}
					<button
						type="button"
						onclick={() => go(i)}
						aria-label="Aller à l'offre {i + 1} — {slide.brand}"
						aria-current={i === current}
						class="h-2 rounded-full transition-all duration-300 {i === current
							? 'w-7 bg-white'
							: 'w-2 bg-white/45 hover:bg-white/70'}"
					></button>
				{/each}
			</div>
			<button
				type="button"
				onclick={() => go(current + 1)}
				aria-label="Offre suivante"
				class={arrowClass}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	{/if}
</section>

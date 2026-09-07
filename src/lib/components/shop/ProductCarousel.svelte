<script lang="ts">
	import { ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import ProductCard from './ProductCard.svelte';
	import type { ProductCard as ProductCardData } from '$lib/shop';

	let {
		title,
		products,
		href,
		linkLabel = 'Voir tout'
	}: {
		title: string;
		products: ProductCardData[];
		/** Destination du lien « Voir tout » de l'en-tête. */
		href?: string;
		linkLabel?: string;
	} = $props();

	let track = $state<HTMLDivElement>();

	/** Fait défiler d'environ une « page » de vignettes. */
	function scrollBy(direction: 1 | -1) {
		if (!track) return;
		track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' });
	}

	const arrowClass =
		'hidden h-9 w-9 items-center justify-center border-[1.5px] border-shop-border bg-white text-shop-ink transition-colors hover:border-shop-ink sm:flex';
</script>

<!--
	Rangée de produits défilante : sur un catalogue de cette taille, un rail
	horizontal montre davantage de références qu'une grille figée, sans allonger
	la page (motif retenu chez les grands catalogues).
-->
<section class="mt-12">
	<div class="mb-4 flex items-end justify-between gap-4 border-b border-shop-border pb-3">
		<h2 class="text-lg font-extrabold tracking-wide text-shop-ink uppercase">{title}</h2>

		<div class="flex items-center gap-3">
			{#if href}
				<a {href} class="text-sm font-semibold text-shop-blue hover:underline">{linkLabel}</a>
			{/if}
			<div class="flex gap-1.5">
				<button
					type="button"
					onclick={() => scrollBy(-1)}
					aria-label="Faire défiler vers la gauche"
					class={arrowClass}
				>
					<ChevronLeftOutline class="h-4 w-4" />
				</button>
				<button
					type="button"
					onclick={() => scrollBy(1)}
					aria-label="Faire défiler vers la droite"
					class={arrowClass}
				>
					<ChevronRightOutline class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>

	<div
		bind:this={track}
		class="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-5 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
	>
		{#each products as item (item.id)}
			<div class="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[23%] xl:w-[15.5%]">
				<ProductCard product={item} />
			</div>
		{/each}
	</div>
</section>

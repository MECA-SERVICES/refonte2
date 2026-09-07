<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import { formatPrice, shopProductPath, type ProductCard as ProductCardData } from '$lib/shop';

	let { product }: { product: ProductCardData } = $props();
</script>

<!--
	Carte produit : visuel carré, marque, désignation sur deux lignes, prix.
	Le rouge est réservé au prix — c'est le signal d'achat de la charte.
-->
<a
	href={shopProductPath(product)}
	class="flex h-full flex-col overflow-hidden rounded-lg border border-shop-border bg-white"
>
	<div class="relative aspect-square p-3">
		{#if product.priceTtcStrike}
			<Badge rounded class="absolute top-3 left-3 z-10 bg-shop-red text-white">Promo</Badge>
		{/if}
		{#if product.imageUrl}
			<img
				src={product.imageUrl}
				alt={product.name}
				loading="lazy"
				class="h-full w-full object-contain"
			/>
		{:else}
			<ImagePlaceholder label="Photo produit" />
		{/if}
	</div>

	<div class="flex flex-1 flex-col border-t border-shop-border/70 p-4">
		{#if product.brandName}
			<p class="text-xs font-medium tracking-wide text-shop-muted uppercase">{product.brandName}</p>
		{/if}

		<h3 class="mt-1 line-clamp-2 min-h-10 text-sm leading-snug font-medium text-shop-ink">
			{product.name}
		</h3>

		<div class="mt-auto pt-3">
			<div class="flex flex-wrap items-baseline gap-x-2">
				<span class="text-lg font-bold text-shop-red">{formatPrice(product.priceTtc)}</span>
				<span class="text-xs text-shop-muted">TTC</span>
				{#if product.priceTtcStrike}
					<span class="text-sm text-shop-muted line-through">
						{formatPrice(product.priceTtcStrike)}
					</span>
				{/if}
			</div>

			<p class="mt-1.5 inline-flex items-center gap-1.5 text-xs text-shop-muted">
				<span
					class="h-1.5 w-1.5 rounded-full {product.stock > 0 ? 'bg-green-600' : 'bg-primary-400'}"
					aria-hidden="true"
				></span>
				{product.stock > 0 ? 'En stock' : 'Sur commande'}
			</p>
		</div>
	</div>
</a>

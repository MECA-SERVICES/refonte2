<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import { ImageOutline } from 'flowbite-svelte-icons';
	import { formatPrice, shopProductPath, type ProductCard as ProductCardData } from '$lib/shop';

	let { product }: { product: ProductCardData } = $props();
</script>

<Card
	href={shopProductPath(product)}
	class="h-full max-w-none border-gray-200 bg-white p-4 hover:shadow-md"
>
	<div class="flex h-40 items-center justify-center overflow-hidden rounded bg-white">
		{#if product.imageUrl}
			<img
				src={product.imageUrl}
				alt={product.name}
				loading="lazy"
				class="max-h-full max-w-full object-contain"
			/>
		{:else}
			<ImageOutline class="h-12 w-12 text-gray-300" />
		{/if}
	</div>

	{#if product.brandName}
		<p class="mt-3 text-xs tracking-wide text-gray-500 uppercase">{product.brandName}</p>
	{/if}

	<h3 class="mt-1 line-clamp-2 min-h-10 text-sm font-medium text-[#282828]">
		{product.name}
	</h3>

	<div class="mt-2 flex items-baseline gap-2">
		<!-- Prix en bleu marine dans les listes, comme sur l'ancienne boutique. -->
		<span class="text-lg font-bold text-shop-blue">{formatPrice(product.priceTtc)}</span>
		{#if product.priceTtcStrike}
			<span class="text-sm text-gray-400 line-through">
				{formatPrice(product.priceTtcStrike)}
			</span>
		{/if}
	</div>

	<p class="mt-1 text-xs font-medium {product.stock > 0 ? 'text-green-600' : 'text-shop-red'}">
		{product.stock > 0 ? 'En stock' : 'Sur commande'}
	</p>
</Card>

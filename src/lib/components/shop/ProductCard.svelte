<script lang="ts">
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import { formatPrice, shopProductPath, type ProductCard as ProductCardData } from '$lib/shop';

	let { product }: { product: ProductCardData } = $props();

	/** Montant économisé lorsqu'un prix barré existe — affiché dans le badge promo. */
	const saved = $derived(
		product.priceTtcStrike ? Number(product.priceTtcStrike) - Number(product.priceTtc) : 0
	);
</script>

<!--
	Carte produit sans cadre : l'image respire, un simple filet la sépare des
	informations. Le badge d'économie est orange (signal commercial de la
	charte), le prix est rouge (signal d'achat).
-->
<a href={shopProductPath(product)} class="group relative flex h-full flex-col">
	{#if saved > 0}
		<span
			class="absolute top-2 left-2 z-10 rounded-lg bg-shop-orange px-2.5 py-1 text-center leading-tight text-white"
		>
			<span class="block text-[10px] font-medium tracking-wide uppercase">Économisez</span>
			<span class="block text-sm font-bold">{formatPrice(saved)}</span>
		</span>
	{/if}

	<div class="aspect-square border-b border-shop-border/60 p-4">
		{#if product.imageUrl}
			<img
				src={product.imageUrl}
				alt={product.name}
				loading="lazy"
				class="h-full w-full object-contain"
			/>
		{:else}
			<ImagePlaceholder label="Photo produit" class="border-0 bg-shop-subtle/60" />
		{/if}
	</div>

	<div class="flex flex-1 flex-col pt-3">
		{#if product.brandName}
			<p class="text-xs font-medium tracking-wide text-shop-muted uppercase">{product.brandName}</p>
		{/if}

		<h3
			class="mt-1 line-clamp-2 min-h-10 text-[15px] leading-snug font-bold text-shop-ink transition-colors group-hover:text-shop-blue"
		>
			{product.name}
		</h3>

		<div class="mt-auto pt-2.5">
			<div class="flex flex-wrap items-baseline gap-x-2">
				<span class="text-lg font-bold text-shop-red">{formatPrice(product.priceTtc)}</span>
				{#if product.priceTtcStrike}
					<span class="text-sm text-shop-muted line-through">
						{formatPrice(product.priceTtcStrike)}
					</span>
				{/if}
				<span class="text-xs text-shop-muted">TTC</span>
			</div>

			<p class="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-shop-ink">
				<span
					class="h-2 w-2 rounded-full {product.stock > 0 ? 'bg-green-500' : 'bg-shop-blue-light'}"
					aria-hidden="true"
				></span>
				{product.stock > 0 ? 'En stock' : 'Sur commande'}
			</p>
		</div>
	</div>
</a>

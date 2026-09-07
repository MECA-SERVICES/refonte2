<script lang="ts">
	import { enhance } from '$app/forms';
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import { formatPrice, shopProductPath, type ProductCard as ProductCardData } from '$lib/shop';

	let { product }: { product: ProductCardData } = $props();

	/** Montant économisé lorsqu'un prix barré existe — porté par le badge. */
	const saved = $derived(
		product.priceTtcStrike ? Number(product.priceTtcStrike) - Number(product.priceTtc) : 0
	);

	const available = $derived(product.stock > 0);
</script>

<!--
	Carte produit encadrée : la référence est affichée dès la liste, car c'est
	elle qui fait foi sur un catalogue de pièces. Le prix reprend le bleu de
	marque, le rouge reste réservé à l'action d'achat.
-->
<article class="flex h-full flex-col border-[1.5px] border-shop-border bg-white">
	<a
		href={shopProductPath(product)}
		class="relative flex aspect-square items-center justify-center border-b border-shop-border/60 p-3"
	>
		{#if product.imageUrl}
			<img
				src={product.imageUrl}
				alt={product.name}
				loading="lazy"
				class="max-h-full max-w-full object-contain"
			/>
		{:else}
			<ImagePlaceholder label="Photo produit" class="rounded-none border-0" />
		{/if}

		{#if saved > 0}
			<span
				class="pointer-events-none absolute top-2.5 left-2.5 bg-shop-red px-2 py-1.5 font-display text-[11px] font-bold tracking-[0.08em] text-white uppercase"
			>
				−{formatPrice(saved)}
			</span>
		{/if}
	</a>

	<div class="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-3.5">
		<!-- Ligne marque toujours présente, même vide : sans elle, les titres
		     ne s'aligneraient pas d'une carte à l'autre. -->
		<p class="min-h-4 text-xs font-bold tracking-[0.1em] text-shop-muted uppercase">
			{product.brandName ?? ''}
		</p>

		<!--
			Les désignations du catalogue montent à 85 caractères : on les coupe à
			deux lignes avec des points de suspension, en réservant la hauteur pour
			que prix et bouton restent alignés sur toute la rangée. Le nom complet
			reste lisible au survol et pour les lecteurs d'écran.
		-->
		<h3 class="font-display text-[15.5px] leading-tight font-semibold text-shop-ink">
			<a
				href={shopProductPath(product)}
				title={product.name}
				class="line-clamp-2 block min-h-[2.5rem] hover:text-shop-blue"
			>
				{product.name}
			</a>
		</h3>

		<p class="truncate text-[13px] text-shop-muted">Réf. {product.reference}</p>

		<!--
			Prix, disponibilité et action forment un bloc solidaire poussé en bas de
			carte. Le `mt-auto` porte sur ce groupe et non sur le seul prix : sinon
			tout l'espace des cartes plus courtes s'ouvrait juste avant le montant.
		-->
		<div class="mt-auto flex flex-col gap-1.5">
			<div class="flex items-baseline gap-2">
				<span class="font-display text-xl font-extrabold text-shop-blue">
					{formatPrice(product.priceTtc)}
				</span>
				<span class="text-xs text-shop-muted">TTC</span>
				{#if product.priceTtcStrike}
					<span class="text-xs text-shop-muted line-through">
						{formatPrice(product.priceTtcStrike)}
					</span>
				{/if}
			</div>

			<p class="text-[13px] font-bold {available ? 'text-green-700' : 'text-shop-orange'}">
				{available ? `En stock (${product.stock})` : 'Sur commande'}
			</p>

			<form method="POST" action="/panier?/add" use:enhance>
				<input type="hidden" name="productId" value={product.id} />
				<input type="hidden" name="quantity" value="1" />
				<button
					type="submit"
					disabled={!available}
					class="w-full bg-shop-red py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-shop-red-dark disabled:cursor-not-allowed disabled:bg-shop-border disabled:text-shop-muted"
				>
					{available ? 'Ajouter au panier' : 'Nous consulter'}
				</button>
			</form>
		</div>
	</div>
</article>

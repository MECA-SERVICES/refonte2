<script lang="ts">
	import { enhance } from '$app/forms';
	import { notifyAddedToCart } from './cart-feedback.svelte';
	import ShopButton from './ShopButton.svelte';
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import { formatPrice, shopProductPath, type ProductCard as ProductCardData } from '$lib/shop';

	let { product }: { product: ProductCardData } = $props();

	/** Montant économisé lorsqu'un prix barré existe — porté par le badge. */
	const saved = $derived(
		product.priceTtcStrike ? Number(product.priceTtcStrike) - Number(product.priceTtc) : 0
	);

	const available = $derived(product.stock > 0);

	/**
	 * `use:enhance` sans argument fait déjà le nécessaire : il poste l'action,
	 * recharge les données (donc le compteur d'en-tête) et met à jour la page.
	 * On se contente d'annoncer la confirmation.
	 */
	const addToCart = () => {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') notifyAddedToCart(`« ${product.name} » ajouté au panier.`);
		};
	};
</script>

<!--
	Carte produit de la charte v2 : angles à 14 px, prix en rouge d'achat,
	pastille verte de disponibilité. La référence est affichée dès la liste,
	car c'est elle qui fait foi sur un catalogue de pièces.
-->
<!--
	`relative` sert de repère au lien d'ensemble posé plus bas : sans lui, la zone
	cliquable se calerait sur la page entière.
-->
<article
	class="relative flex h-full flex-col overflow-hidden rounded-[14px] border-[1.5px] border-shop-border-soft bg-white transition-[border-color,box-shadow] hover:border-primary-200 hover:shadow-[0_10px_30px_rgba(30,36,54,0.08)]"
>
	<a
		href={shopProductPath(product)}
		class="relative flex h-[190px] items-center justify-center overflow-hidden border-b border-shop-border-soft"
	>
		{#if product.imageUrl}
			<!--
				Faute de photo, on affiche le logo de la marque : 68 % du catalogue
				n'en a aucune, et un logo renseigne mieux qu'un cadre vide. Le texte
				alternatif reste celui de la marque, pour qu'un lecteur d'écran
				n'annonce pas une photo du produit.

				La photo occupe le cadre sans marge ni rognage (`contain`) ; le
				logo garde en plus une respiration, collé aux bords il serait
				illisible.
			-->
			<img
				src={product.imageUrl}
				alt={product.imageIsBrandLogo ? (product.brandName ?? '') : product.name}
				loading="lazy"
				class="h-full w-full object-contain {product.imageIsBrandLogo ? 'p-4' : ''}"
			/>
		{:else}
			<ImagePlaceholder label="Photo produit" class="border-0" />
		{/if}

		{#if saved > 0}
			<span
				class="pointer-events-none absolute top-2.5 left-2.5 rounded-full bg-shop-orange px-2.5 py-1 font-display text-[11.5px] font-extrabold text-white"
			>
				−{formatPrice(saved)}
			</span>
		{/if}
	</a>

	<div class="flex flex-1 flex-col gap-1.5 px-4 pt-3.5 pb-4">
		<!-- Ligne marque toujours présente, même vide : sans elle, les titres
		     ne s'aligneraient pas d'une carte à l'autre. -->
		<p class="min-h-4 text-[11.5px] font-bold tracking-[0.1em] text-shop-muted uppercase">
			{#if product.brandName}{product.brandName}{/if}
		</p>

		<!--
			Les désignations du catalogue montent à 85 caractères : on les coupe à
			deux lignes avec des points de suspension, en réservant la hauteur pour
			que prix et bouton restent alignés sur toute la rangée. Le nom complet
			reste lisible au survol et pour les lecteurs d'écran.
		-->
		<h3 class="font-display text-[15px] leading-[1.3] font-bold text-shop-ink">
			<!--
				`after:absolute after:inset-0` étend la zone cliquable à toute la
				carte : marque, référence et prix ne captaient rien, et le bouton
				désactivé avalait les clics sans conduire nulle part. Les éléments
				interactifs placés au-dessus (le formulaire d'achat) restent
				accessibles grâce à leur `relative z-10`.
			-->
			<a
				href={shopProductPath(product)}
				title={product.name}
				class="line-clamp-2 block min-h-[2.5rem] after:absolute after:inset-0 after:content-[''] hover:text-shop-blue"
			>
				{product.name}
			</a>
		</h3>

		<p class="truncate text-[12.5px] text-shop-faint">Réf. {product.reference}</p>

		<!--
			Prix, disponibilité et action forment un bloc solidaire poussé en bas de
			carte. Le `mt-auto` porte sur ce groupe et non sur le seul prix : sinon
			tout l'espace des cartes plus courtes s'ouvrait juste avant le montant.
		-->
		<div class="mt-auto flex flex-col gap-1.5">
			<div class="flex flex-wrap items-baseline gap-2">
				<span class="font-display text-[21px] font-extrabold tracking-[-0.01em] text-shop-red">
					{formatPrice(product.priceTtc)}
				</span>
				{#if product.priceTtcStrike}
					<span class="text-[13.5px] text-shop-faint line-through">
						{formatPrice(product.priceTtcStrike)}
					</span>
				{/if}
				<span class="text-xs text-shop-muted">TTC</span>
			</div>

			<p class="flex items-center gap-2 text-[13px] text-shop-ink-soft">
				<span
					class="h-2 w-2 shrink-0 rounded-full {available
						? 'bg-shop-green'
						: 'bg-shop-orange-light'}"
				></span>
				{available ? `En stock (${product.stock})` : 'Sur commande'}
			</p>

			<form method="POST" action="/panier?/add" use:enhance={addToCart} class="relative z-10">
				<input type="hidden" name="productId" value={product.id} />
				<input type="hidden" name="quantity" value="1" />
				<ShopButton type="submit" variant="buy" size="sm" block disabled={!available}>
					{available ? 'Ajouter au panier' : 'Nous consulter'}
				</ShopButton>
			</form>
		</div>
	</div>
</article>

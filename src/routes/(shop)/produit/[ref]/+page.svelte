<script lang="ts">
	import { enhance } from '$app/forms';
	import { notifyAddedToCart } from '$lib/components/shop/cart-feedback.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import { formatPrice } from '$lib/shop';
	import { resolveDeliveryTime } from '$lib/delivery-time';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const product = $derived(data.product);
	const images = $derived(product.media.filter((m) => m.type === 'image'));
	/** Vues éclatées et notices : documents techniques attachés à la fiche. */
	const documents = $derived(product.media.filter((m) => m.type === 'pdf'));

	/** Image affichée en grand ; l'index repart à zéro quand la fiche change. */
	let selected = $state<{ id: number; index: number } | null>(null);
	const activeIndex = $derived.by(() => {
		const current = selected;
		return current && current.id === product.id ? current.index : 0;
	});

	/**
	 * Quantité minimale par commande, telle que réglée en back-office.
	 *
	 * Certaines références ne se vendent que par lot : visserie par 10, joints
	 * par jeu. Le sélecteur part de là et n'accepte pas moins.
	 */
	const minQuantity = $derived(Math.max(1, product.minOrderQuantity ?? 1));

	/** Quantité à ajouter au panier, bornée par le stock. */
	let quantity = $state(1);
	// Le minimum peut dépasser la valeur initiale : on s'y aligne.
	$effect(() => {
		if (quantity < minQuantity) quantity = minQuantity;
	});

	const maxQuantity = $derived(Math.max(minQuantity, product.stock));

	/** Éco-participation incluse dans le prix, affichée à part (R6). */
	const ecotax = $derived(Number(product.ecotax ?? 0));

	const saved = $derived(
		product.priceTtcStrike ? Number(product.priceTtcStrike) - Number(product.priceTtc) : 0
	);
	/** Remise en pourcentage, pour la pilule commerciale du prix barré. */
	const savedPercent = $derived(
		product.priceTtcStrike ? Math.round((saved / Number(product.priceTtcStrike)) * 100) : 0
	);
	/*
	 * Un article réservé à la boutique physique n'est pas commandable, même en
	 * stock : le serveur refuserait l'ajout, autant ne pas proposer le bouton.
	 */
	const available = $derived(product.stock > 0 && product.availableForOrder !== false);

	/** Message de délai paramétré en back-office, ou celui de la boutique. */
	const deliveryTime = $derived(resolveDeliveryTime(product, available));

	/**
	 * `use:enhance` sans argument recharge déjà les données après l'action — donc
	 * le compteur d'en-tête. On ajoute seulement la confirmation visuelle.
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

	const crumbs = $derived([
		...product.breadcrumb.map((c) => ({ label: c.name, href: `/categorie/${c.slug}` })),
		{ label: product.name }
	]);

	/**
	 * Caractéristiques affichées : celles extraites du catalogue en priorité,
	 * complétées par les données d'identification de la fiche.
	 */
	const specs = $derived([
		...product.specs.map((s) => ({ k: s.name, v: s.value })),
		{ k: 'Référence MS Shop', v: product.reference },
		...(product.supplierReference
			? [{ k: 'Référence constructeur', v: product.supplierReference }]
			: []),
		...(product.ean13 ? [{ k: 'Code EAN', v: product.ean13 }] : []),
		...(product.brandName ? [{ k: 'Marque', v: product.brandName }] : [])
	]);

	// L'onglet « Garantie, S.A.V & livraison » reviendra quand ces informations
	// seront servies par de vraies données (conditions par produit) — le texte
	// statique de la maquette a été retiré en attendant.
	type TabId = 'desc' | 'specs';
	let tab = $state<TabId>('desc');

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'desc', label: 'Description' },
		{ id: 'specs', label: 'Caractéristiques' }
	];

	/** Quatre promesses de la boutique, sous le bloc d'achat. */
	const reassurance = [
		'Pièces 100 % origine, référencées constructeur',
		'S.A.V dans notre atelier de Carantilly',
		'Expédition sous 24 à 48 h · retrait gratuit',
		'Paiement sécurisé, mandat administratif'
	];
</script>

<svelte:head>
	<title>{product.metaTitle ?? `${product.name} — MS Shop`}</title>
	<meta
		name="description"
		content={product.metaDescription ??
			product.shortDescription ??
			`${product.name} — référence ${product.reference}, disponible chez MS Shop.`}
	/>
</svelte:head>

<Breadcrumb items={crumbs} />

<div class="grid items-start gap-9 lg:grid-cols-2">
	<!-- ================= Galerie ================= -->
	<!-- Vignettes en colonne à gauche de la grande image, comme sur la maquette ;
	     la colonne disparaît quand la fiche n'a qu'un visuel. -->
	<div class="grid min-w-0 gap-3 {images.length > 1 ? 'grid-cols-[72px_minmax(0,1fr)]' : ''}">
		{#if images.length > 1}
			<div class="flex flex-col gap-2.5">
				{#each images.slice(0, 6) as media, i (media.id)}
					<button
						type="button"
						onclick={() => (selected = { id: product.id, index: i })}
						aria-label="Voir l'image {i + 1}"
						aria-current={i === activeIndex}
						class="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[10px] border-2 bg-shop-subtle transition-colors {i ===
						activeIndex
							? 'border-shop-blue'
							: 'border-shop-border-soft hover:border-shop-border'}"
					>
						<img
							src={media.url}
							alt={media.alt ?? ''}
							loading="lazy"
							class="h-full w-full object-contain"
						/>
					</button>
				{/each}
			</div>
		{/if}

		<div
			class="relative flex h-[380px] items-center justify-center overflow-hidden rounded-2xl border-[1.5px] border-shop-border-soft bg-shop-subtle sm:h-[520px]"
		>
			{#if images.length > 0}
				<!-- La photo occupe tout le cadre, sans marge ni rognage. -->
				<img
					src={images[activeIndex]?.url}
					alt={images[activeIndex]?.alt ?? product.name}
					class="h-full w-full object-contain"
				/>
			{:else if product.brandLogoUrl}
				<!-- Aucune photo : le logo de la marque vaut mieux qu'un cadre vide
				     sur une fiche de pièce détachée. -->
				<img
					src={product.brandLogoUrl}
					alt={product.brandName ?? ''}
					class="max-h-full max-w-full object-contain p-6"
				/>
			{:else}
				<ImagePlaceholder label="Photo produit" class="border-0 bg-transparent" />
			{/if}

			{#if saved > 0}
				<span
					class="absolute top-3.5 left-3.5 rounded-full bg-shop-orange px-3 py-1.5 font-display text-xs font-extrabold text-white"
				>
					−{savedPercent} %
				</span>
			{/if}

			<a
				href="https://doc.mecaservicesshop.fr"
				target="_blank"
				rel="noopener"
				class="absolute right-3.5 bottom-3.5 flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-display text-[13px] font-bold text-shop-ink shadow-[0_4px_14px_rgba(30,36,54,0.12)] transition-colors hover:text-shop-blue"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M14.7 6.3a4 4 0 0 0 5 5L13 18a3 3 0 0 1-4.2 0L4 13.2a3 3 0 0 1 0-4.2L10.7 2.3a4 4 0 0 0 4 4z"
					/>
				</svg>
				Vue éclatée
			</a>
		</div>
	</div>

	<!-- ================= Informations & achat ================= -->
	<div class="min-w-0 lg:sticky lg:top-40">
		{#if product.brandName}
			<p class="text-xs font-bold tracking-[0.12em] uppercase">
				<a href="/marque/{product.brandSlug}" class="text-shop-blue hover:underline">
					{product.brandName}
				</a>
			</p>
		{/if}

		<h1
			class="mt-2 font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.025em] text-balance text-shop-ink sm:text-[32px]"
		>
			{product.name}
		</h1>

		<p class="mt-2 text-[13.5px] text-shop-muted">
			Réf. MS SHOP <strong class="text-shop-ink">{product.reference}</strong>
			{#if product.supplierReference}
				· Réf. constructeur <strong class="text-shop-ink">{product.supplierReference}</strong>
			{/if}
		</p>

		<!-- Bloc d'achat : prix, disponibilité et action dans une même carte -->
		<div class="mt-4 rounded-2xl border-[1.5px] border-shop-border-soft bg-white p-5 sm:p-6">
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
				<span
					class="font-display text-[38px] leading-none font-extrabold tracking-[-0.03em] text-shop-red"
				>
					{formatPrice(product.priceTtc)}
				</span>
				<span class="text-sm text-shop-muted">TTC · soit {formatPrice(product.priceHt)} HT</span>
				{#if product.priceTtcStrike}
					<s class="text-[15px] text-shop-faint">{formatPrice(product.priceTtcStrike)}</s>
				{/if}
				{#if saved > 0}
					<span
						class="rounded-full bg-shop-promo px-2.5 py-1 font-display text-xs font-extrabold text-shop-orange-deep"
					>
						−{savedPercent} %
					</span>
				{/if}
			</div>

			{#if ecotax > 0}
				<!-- L'éco-participation doit figurer séparément du prix de vente :
				     c'est une obligation légale, pas une préférence d'affichage
				     (CDC 10, R6). -->
				<p class="mt-2 text-[13px] text-shop-muted">
					Dont éco-participation : <span class="font-semibold text-shop-ink">
						{formatPrice(ecotax)}
					</span>
				</p>
			{/if}

			<p class="mt-3.5 flex items-center gap-2 text-sm font-bold text-shop-ink">
				<span
					class="h-2.5 w-2.5 shrink-0 rounded-full {available
						? 'bg-shop-green'
						: 'bg-shop-orange-light'}"
					aria-hidden="true"
				></span>
				<!--
					Le message de délai vient du back-office (onglet « Livraison ») ;
					à défaut de réglage propre, celui de la boutique s'applique. Un
					produit configuré sans message n'affiche que l'état du stock.
				-->
				{#if available}
					En stock atelier · {product.stock} unité{product.stock > 1 ? 's' : ''}
				{:else}
					{deliveryTime ?? 'Sur commande — nous consulter pour le délai'}
				{/if}
			</p>
			{#if available}
				<p class="mt-1 text-[13.5px] text-shop-muted">
					{deliveryTime ? `${deliveryTime} · ` : ''}retrait gratuit à l'atelier de Carantilly
				</p>
			{/if}
			{#if minQuantity > 1}
				<p class="mt-2 text-[13px] text-shop-muted">
					Vendu par {minQuantity} — quantité minimale de commande.
				</p>
			{/if}

			<form
				method="POST"
				action="?/add"
				use:enhance={addToCart}
				class="mt-4.5 flex flex-wrap items-stretch gap-2.5"
			>
				<input type="hidden" name="productId" value={product.id} />

				<div class="flex overflow-hidden rounded-[10px] border-[1.5px] border-shop-border">
					<button
						type="button"
						onclick={() => (quantity = Math.max(minQuantity, quantity - 1))}
						disabled={!available || quantity <= minQuantity}
						aria-label="Diminuer la quantité"
						class="bg-shop-subtle px-4 text-lg text-shop-ink-soft transition-colors hover:bg-shop-border-soft disabled:opacity-40"
					>
						−
					</button>
					<label class="sr-only" for="quantity">Quantité</label>
					<input
						id="quantity"
						name="quantity"
						type="number"
						min={minQuantity}
						max={maxQuantity}
						bind:value={quantity}
						disabled={!available}
						class="w-14 [appearance:textfield] border-0 bg-transparent px-0 py-3 text-center font-display font-bold text-shop-ink focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					/>
					<button
						type="button"
						onclick={() => (quantity = Math.min(maxQuantity, quantity + 1))}
						disabled={!available || quantity >= maxQuantity}
						aria-label="Augmenter la quantité"
						class="bg-shop-subtle px-4 text-lg text-shop-ink-soft transition-colors hover:bg-shop-border-soft disabled:opacity-40"
					>
						+
					</button>
				</div>

				<ShopButton
					type="submit"
					variant="buy"
					size="lg"
					disabled={!available}
					class="flex-1 basis-52"
				>
					{available ? 'Ajouter au panier' : 'Nous consulter'}
				</ShopButton>
			</form>

			{#if form?.message}
				<p
					class="mt-3 rounded-[10px] border px-3.5 py-2.5 text-sm font-medium {form.added
						? 'border-primary-200 bg-primary-50 text-primary-800'
						: 'border-shop-red text-shop-red'}"
					role="status"
				>
					{form.message}
					{#if form.added}
						<a href="/panier" class="ms-1 font-semibold underline underline-offset-2">
							Voir mon panier
						</a>
					{/if}
				</p>
			{/if}

			<div class="mt-2.5 flex flex-wrap gap-2">
				<ShopButton href="/inscription" variant="outline" size="sm" class="flex-1 basis-40">
					Demander un devis pro
				</ShopButton>
				<ShopButton href="tel:0950922336" variant="outline" size="sm" class="flex-1 basis-40">
					Retrait atelier gratuit
				</ShopButton>
			</div>
		</div>

		<!-- Quatre promesses, en grille compacte sous le bloc d'achat -->
		<ul class="mt-4 grid gap-x-4.5 gap-y-2 text-[13.5px] text-shop-ink-soft sm:grid-cols-2">
			{#each reassurance as promise (promise)}
				<li class="flex items-start gap-2">
					<span class="font-extrabold text-shop-green" aria-hidden="true">✓</span>
					{promise}
				</li>
			{/each}
		</ul>

		<!-- Compatibilité : la question centrale sur une pièce détachée -->
		<div class="mt-4 flex items-center gap-3.5 rounded-[14px] bg-primary-50 px-4 py-3.5">
			<span
				class="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-[10px] bg-shop-blue font-display text-[15px] font-extrabold text-white"
				aria-hidden="true"
			>
				?
			</span>
			<p class="text-[13.5px] leading-normal text-shop-ink-soft">
				<strong class="text-shop-ink">Compatible avec ma machine ?</strong>
				Donnez-nous la marque et le modèle, on vérifie la référence avant que vous commandiez :
				<a href="tel:0950922336" class="font-bold text-shop-blue hover:underline">09 50 92 23 36</a>
			</p>
		</div>
	</div>
</div>

<!-- ================= Onglets ================= -->
<section class="mt-11">
	<div class="flex flex-wrap gap-1 border-b-[1.5px] border-shop-border-soft">
		{#each tabs as item (item.id)}
			<button
				type="button"
				onclick={() => (tab = item.id)}
				aria-current={tab === item.id}
				class="-mb-[1.5px] border-b-[3px] px-4 py-3 font-display text-[14.5px] font-bold transition-colors {tab ===
				item.id
					? 'border-shop-blue text-shop-blue'
					: 'border-transparent text-shop-muted hover:text-shop-ink'}"
			>
				{item.label}
			</button>
		{/each}
	</div>

	<div class="pt-6">
		{#if tab === 'desc'}
			{#if product.description}
				<div
					class="format max-w-[72ch] text-[15.5px] leading-relaxed text-pretty text-shop-ink-soft"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
					{@html product.description}
				</div>
			{:else if product.shortDescription}
				<div
					class="format max-w-[72ch] text-[15.5px] leading-relaxed text-pretty text-shop-ink-soft"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
					{@html product.shortDescription}
				</div>
			{:else}
				<p class="text-[15.5px] text-shop-muted">
					Aucune description détaillée pour cette référence. Appelez-nous au
					<a href="tel:0950922336" class="font-semibold text-shop-blue hover:underline">
						09 50 92 23 36
					</a>
					: nous avons la documentation constructeur.
				</p>
			{/if}
		{:else}
			<div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
				{#each specs as spec (spec.k)}
					<div
						class="flex items-baseline justify-between gap-3 rounded-[10px] border-[1.5px] border-shop-border-soft px-4 py-3 text-sm"
					>
						<span class="text-shop-muted">{spec.k}</span>
						<strong class="text-right text-shop-ink">{spec.v}</strong>
					</div>
				{/each}
			</div>

			{#if documents.length > 0}
				<div class="mt-5">
					<Heading as="p" size="label">Documents techniques</Heading>
					<ul class="mt-2 space-y-1.5">
						{#each documents as doc (doc.id)}
							<li>
								<a
									href={doc.url}
									target="_blank"
									rel="noopener"
									class="text-sm font-medium text-shop-blue hover:underline"
								>
									{doc.alt ?? 'Vue éclatée / notice (PDF)'}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>
</section>

{#if product.variants.length > 0}
	<section class="mt-12">
		<Heading size="block">Déclinaisons</Heading>
		<ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each product.variants as variant (variant.id)}
				<li class="rounded-[14px] border-[1.5px] border-shop-border-soft bg-white p-4">
					<p class="font-display font-bold text-shop-ink">{variant.name}</p>
					{#if variant.reference}
						<p class="mt-0.5 text-xs text-shop-faint">Réf. {variant.reference}</p>
					{/if}
					<p class="mt-2 flex items-center gap-2 text-sm text-shop-ink-soft">
						<span
							class="h-2 w-2 shrink-0 rounded-full {variant.stock > 0
								? 'bg-shop-green'
								: 'bg-shop-orange-light'}"
							aria-hidden="true"
						></span>
						{variant.stock > 0 ? `En stock (${variant.stock})` : 'Sur commande'}
					</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if product.related.length > 0}
	<section class="mt-12">
		<div class="mb-5 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
			<Heading size="block">Vous aimerez aussi</Heading>
			{#if product.brandName}
				<a
					href="/marque/{product.brandSlug}"
					class="text-sm font-bold text-shop-blue hover:underline"
				>
					Toute la gamme {product.brandName} →
				</a>
			{/if}
		</div>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each product.related as item (item.id)}
				<ProductCard product={item} />
			{/each}
		</div>
	</section>
{/if}

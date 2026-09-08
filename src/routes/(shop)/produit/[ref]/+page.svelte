<script lang="ts">
	import { enhance } from '$app/forms';
	import { notifyAddedToCart } from '$lib/components/shop/cart-feedback.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import { formatPrice } from '$lib/shop';
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

	/** Quantité à ajouter au panier, bornée par le stock. */
	let quantity = $state(1);
	const maxQuantity = $derived(Math.max(1, product.stock));

	const saved = $derived(
		product.priceTtcStrike ? Number(product.priceTtcStrike) - Number(product.priceTtc) : 0
	);
	const available = $derived(product.stock > 0);

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

	type TabId = 'desc' | 'specs' | 'sav';
	let tab = $state<TabId>('desc');

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'desc', label: 'Description' },
		{ id: 'specs', label: 'Caractéristiques' },
		{ id: 'sav', label: 'Garantie & SAV' }
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

<div class="grid items-start gap-8 md:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
	<!-- ================= Galerie ================= -->
	<div class="min-w-0">
		<div
			class="flex h-[440px] items-center justify-center border-[1.5px] border-shop-border bg-white p-6"
		>
			{#if images.length > 0}
				<img
					src={images[activeIndex]?.url}
					alt={images[activeIndex]?.alt ?? product.name}
					class="max-h-full max-w-full object-contain"
				/>
			{:else}
				<ImagePlaceholder label="Photo produit" class="border-0" />
			{/if}
		</div>

		{#if images.length > 1}
			<div class="mt-2.5 grid grid-cols-4 gap-2.5">
				{#each images.slice(0, 8) as media, i (media.id)}
					<button
						type="button"
						onclick={() => (selected = { id: product.id, index: i })}
						aria-label="Voir l'image {i + 1}"
						aria-current={i === activeIndex}
						class="flex h-[88px] items-center justify-center border-[1.5px] bg-white p-2 transition-colors {i ===
						activeIndex
							? 'border-shop-ink'
							: 'border-shop-border hover:border-shop-ink/50'}"
					>
						<img
							src={media.url}
							alt={media.alt ?? ''}
							loading="lazy"
							class="max-h-full max-w-full object-contain"
						/>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ================= Informations & achat ================= -->
	<div class="min-w-0">
		{#if product.brandName}
			<p class="mb-2.5 text-xs font-bold tracking-[0.12em] text-shop-muted uppercase">
				<a href="/recherche?marque={product.brandSlug}" class="hover:text-shop-blue">
					{product.brandName}
				</a>
			</p>
		{/if}

		<h1
			class="font-display text-[26px] leading-tight font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[34px]"
		>
			{product.name}
		</h1>

		<p class="mt-2.5 mb-4 text-sm text-shop-muted">
			Réf. MS SHOP {product.reference}
			{#if product.supplierReference}
				· Réf. constructeur {product.supplierReference}
			{/if}
		</p>

		<!-- Bloc d'achat : le prix et l'action, cerclés d'un trait franc -->
		<div class="mb-4 border-[1.5px] border-shop-ink bg-white p-5 sm:p-6">
			<div class="flex flex-wrap items-baseline gap-3">
				<span class="font-display text-4xl font-extrabold tracking-[-0.03em] text-shop-red">
					{formatPrice(product.priceTtc)}
				</span>
				<span class="text-sm text-shop-muted">
					TTC · soit {formatPrice(product.priceHt)} HT
				</span>
				{#if product.priceTtcStrike}
					<span class="text-base text-shop-muted line-through">
						{formatPrice(product.priceTtcStrike)}
					</span>
				{/if}
				{#if saved > 0}
					<span
						class="bg-shop-orange px-2.5 py-1 font-display text-xs font-bold tracking-wide text-white uppercase"
					>
						Économisez {formatPrice(saved)}
					</span>
				{/if}
			</div>

			<p class="mt-2 text-sm font-bold {available ? 'text-shop-blue' : 'text-shop-orange'}">
				{#if available}
					En stock atelier · {product.stock}
					unité{product.stock > 1 ? 's' : ''} · expédié sous 24 à 48 h
				{:else}
					Sur commande — nous consulter pour le délai
				{/if}
			</p>

			<form
				method="POST"
				action="?/add"
				use:enhance={addToCart}
				class="mt-4 flex flex-wrap items-stretch gap-2.5"
			>
				<input type="hidden" name="productId" value={product.id} />

				<div class="flex border-[1.5px] border-shop-border bg-shop-subtle">
					<button
						type="button"
						onclick={() => (quantity = Math.max(1, quantity - 1))}
						disabled={!available || quantity <= 1}
						aria-label="Diminuer la quantité"
						class="px-4 text-lg text-shop-ink disabled:opacity-40"
					>
						−
					</button>
					<label class="sr-only" for="quantity">Quantité</label>
					<input
						id="quantity"
						name="quantity"
						type="number"
						min="1"
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
						class="px-4 text-lg text-shop-ink disabled:opacity-40"
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
					class="mt-3 border px-3 py-2 text-sm font-medium {form.added
						? 'border-shop-blue bg-primary-50 text-primary-800'
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

			<div class="mt-3.5 flex flex-wrap gap-3.5 text-[13px] text-shop-muted">
				<span>Livraison France · offerte dès 250 €</span>
				<span aria-hidden="true">·</span>
				<span>Retrait atelier Carantilly gratuit</span>
			</div>
		</div>

		<!-- Compatibilité : la question centrale sur une pièce détachée -->
		<div class="mb-4 border-[1.5px] border-shop-border bg-shop-border-soft p-5">
			<p class="font-display text-[15px] font-extrabold text-shop-ink">
				Compatible avec ma machine ?
			</p>
			<p class="mt-1.5 mb-3 text-sm text-shop-ink-soft">
				Donnez-nous la marque et le modèle de votre matériel : nous vérifions la référence avec vous
				avant que vous commandiez.
			</p>
			<div class="flex flex-wrap gap-2">
				<ShopButton href="tel:0950922336" variant="outline" size="sm">
					Vérifier ma compatibilité
				</ShopButton>
				<ShopButton href="https://doc.mecaservicesshop.fr" variant="outline" size="sm">
					Voir la vue éclatée
				</ShopButton>
			</div>
		</div>

		<!-- ================= Onglets ================= -->
		<div class="flex flex-wrap gap-0.5 border-b-[1.5px] border-shop-border">
			{#each tabs as item (item.id)}
				<button
					type="button"
					onclick={() => (tab = item.id)}
					aria-current={tab === item.id}
					class="-mb-[1.5px] border-b-[3px] px-3.5 py-3 font-display text-[14.5px] font-bold transition-colors {tab ===
					item.id
						? 'border-shop-red text-shop-ink'
						: 'border-transparent text-shop-muted hover:text-shop-ink'}"
				>
					{item.label}
				</button>
			{/each}
		</div>

		<div class="py-5">
			{#if tab === 'desc'}
				{#if product.description}
					<div class="text-[15.5px] leading-relaxed text-pretty text-shop-ink-soft">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
						{@html product.description}
					</div>
				{:else if product.shortDescription}
					<div class="text-[15.5px] leading-relaxed text-pretty text-shop-ink-soft">
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
			{:else if tab === 'specs'}
				<div class="grid gap-px border border-shop-border bg-shop-border sm:grid-cols-2">
					{#each specs as spec (spec.k)}
						<div class="bg-white px-4 py-3.5">
							<p class="text-[12.5px] text-shop-muted">{spec.k}</p>
							<p class="mt-0.5 font-display text-[15px] font-bold text-shop-ink">{spec.v}</p>
						</div>
					{/each}
				</div>

				{#if documents.length > 0}
					<div class="mt-4">
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
			{:else}
				<p class="mb-3.5 text-[15.5px] leading-relaxed text-shop-ink-soft">
					Garantie constructeur assurée dans notre atelier de Carantilly : nous ne renvoyons pas
					votre matériel à l'usine.
				</p>
				<p class="text-[15.5px] leading-relaxed text-shop-ink-soft">
					Entretien, affûtage, réparation : dépôt sur place ou enlèvement par transporteur. Devis
					systématique avant intervention, pièces d'origine uniquement.
				</p>
			{/if}
		</div>
	</div>
</div>

{#if product.variants.length > 0}
	<section class="mt-12">
		<Heading size="block">Déclinaisons</Heading>
		<ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each product.variants as variant (variant.id)}
				<li class="border-[1.5px] border-shop-border bg-white p-4">
					<p class="font-display font-bold text-shop-ink">{variant.name}</p>
					{#if variant.reference}
						<p class="mt-0.5 text-xs text-shop-muted">Réf. {variant.reference}</p>
					{/if}
					<p class="mt-2 text-sm text-shop-muted">
						{variant.stock > 0 ? `En stock (${variant.stock})` : 'Sur commande'}
					</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if product.related.length > 0}
	<section class="mt-12 border-t border-shop-border pt-8">
		<Heading size="block" class="mb-5">Vous aimerez aussi</Heading>
		<div class="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
			{#each product.related as item (item.id)}
				<ProductCard product={item} />
			{/each}
		</div>
	</section>
{/if}

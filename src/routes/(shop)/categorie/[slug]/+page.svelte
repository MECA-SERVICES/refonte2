<script lang="ts">
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import CatalogSidebar from '$lib/components/shop/CatalogSidebar.svelte';
	import ActiveFilters from '$lib/components/shop/ActiveFilters.svelte';
	import SortSelect from '$lib/components/shop/SortSelect.svelte';
	import Pagination from '$lib/components/shop/Pagination.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Les ancêtres sont cliquables, la catégorie courante ne l'est pas. */
	const crumbs = $derived(
		data.breadcrumb.map((c, i) => ({
			label: c.name,
			href: i < data.breadcrumb.length - 1 ? `/categorie/${c.slug}` : undefined
		}))
	);

	/** Filtres actifs, sous forme de puces retirables. */
	const chips = $derived([
		...(data.selected.inStockOnly ? [{ key: 'stock', value: '1', label: 'En stock magasin' }] : []),
		...data.selected.brands.map((b) => ({ key: 'marque', value: b.value, label: b.label })),
		...data.selected.specs.map((token) => ({
			key: 'spec',
			value: token,
			label: token.replace(':', ' : ')
		}))
	]);
</script>

<svelte:head>
	<title>{data.category.name} — MS Shop</title>
	<meta
		name="description"
		content={data.category.description ??
			`${data.category.name} : pièces détachées et matériels de motoculture, 100 % origine.`}
	/>
</svelte:head>

<Breadcrumb items={crumbs} />

<div class="mb-6">
	<Heading as="h1" size="page">{data.category.name}</Heading>
	{#if data.category.description}
		<div class="format mt-2 max-w-[62ch] text-[15px] text-shop-muted">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
			{@html data.category.description}
		</div>
	{/if}

	<!-- Les sous-rayons en pilules : l'entrée la plus directe vers le bon
	     sous-ensemble, avant même de filtrer. -->
	{#if data.children.length > 0}
		<div class="mt-4 flex flex-wrap gap-2">
			{#each data.children as child (child.id)}
				<a
					href="/categorie/{child.slug}"
					class="rounded-full border-[1.5px] border-shop-border bg-white px-3.5 py-1.5 font-display text-[13.5px] font-bold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
				>
					{child.name}
				</a>
			{/each}
		</div>
	{/if}
</div>

<div class="grid items-start gap-7 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
	<!-- ================= Filtres ================= -->
	<CatalogSidebar
		brands={data.facets.brands}
		selectedBrands={data.selected.brands.map((b) => b.value)}
		inStockOnly={data.selected.inStockOnly}
		inStockTotal={data.facets.inStockTotal}
		specs={data.facets.specs}
		selectedSpecs={data.selected.specs}
	/>

	<!-- ================= Résultats ================= -->
	<div class="min-w-0">
		<div class="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<span class="text-[13.5px] text-shop-muted">
				{data.products.rows.length} produit{data.products.rows.length > 1 ? 's' : ''}
			</span>
			<SortSelect sort={data.sort} />
		</div>

		<ActiveFilters {chips} />

		{#if data.products.rows.length === 0}
			<Panel class="mt-6 px-6 py-12 text-center">
				<p class="font-display font-bold text-shop-ink">
					Aucun produit ne correspond à ces critères.
				</p>
				<p class="mt-2 text-sm text-shop-muted">
					{#if chips.length > 0}
						Retirez un filtre pour élargir la recherche, ou parcourez tout le catalogue.
					{:else}
						Parcourez le reste du catalogue, ou appelez-nous : on identifie la pièce avec vous.
					{/if}
				</p>
				<div class="mt-5">
					<ShopButton href="/recherche" variant="primary" size="sm">
						Voir tout le catalogue
					</ShopButton>
				</div>
			</Panel>
		{:else}
			<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
				{#each data.products.rows as item (item.id)}
					<ProductCard product={item} />
				{/each}
			</div>
		{/if}

		<Pagination page={data.products.page} hasNextPage={data.products.hasNextPage} />
	</div>
</div>

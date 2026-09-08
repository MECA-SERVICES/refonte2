<script lang="ts">
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import CatalogSidebar from '$lib/components/shop/CatalogSidebar.svelte';
	import ActiveFilters from '$lib/components/shop/ActiveFilters.svelte';
	import SortSelect from '$lib/components/shop/SortSelect.svelte';
	import Pagination from '$lib/components/shop/Pagination.svelte';
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
		...(data.selected.inStockOnly ? [{ key: 'stock', value: '1', label: 'En stock atelier' }] : []),
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

<div class="grid items-start gap-7 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
	<!-- ================= Navigation & filtres ================= -->
	<CatalogSidebar
		tree={data.children}
		treeTitle="Sous-rayons"
		brands={data.facets.brands}
		selectedBrands={data.selected.brands.map((b) => b.value)}
		inStockOnly={data.selected.inStockOnly}
		inStockTotal={data.facets.inStockTotal}
		specs={data.facets.specs}
		selectedSpecs={data.selected.specs}
	/>

	<!-- ================= Résultats ================= -->
	<div class="min-w-0">
		<div class="mb-2 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1
					class="font-display text-[28px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[34px]"
				>
					{data.category.name}
				</h1>
				{#if data.category.description}
					<div class="mt-1.5 max-w-[60ch] text-[15px] text-shop-muted">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
						{@html data.category.description}
					</div>
				{/if}
			</div>

			<div class="flex items-center gap-2.5">
				<span class="text-[13.5px] text-shop-muted">
					{data.products.rows.length} produit{data.products.rows.length > 1 ? 's' : ''}
				</span>
				<SortSelect sort={data.sort} />
			</div>
		</div>

		<ActiveFilters {chips} />

		{#if data.products.rows.length === 0}
			<p
				class="mt-6 border-[1.5px] border-shop-border bg-white px-6 py-12 text-center text-shop-muted"
			>
				Aucun produit ne correspond à ces critères.
				{#if chips.length > 0}
					Retirez un filtre pour élargir la recherche.
				{/if}
			</p>
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

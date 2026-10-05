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

	const title = $derived(data.q ? `Résultats pour « ${data.q} »` : 'Tout le catalogue');

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
	<title>{title} — MS Shop</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<Breadcrumb items={[{ label: data.q ? 'Recherche' : 'Catalogue' }]} />

<div class="mb-6">
	<Heading as="h1" size="page">{title}</Heading>
	{#if !data.q}
		<p class="mt-2 max-w-[62ch] text-[15px] text-shop-muted">
			Les dernières références ajoutées au catalogue. Affinez par marque ou par disponibilité.
		</p>
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
					{#if data.q}
						Aucun résultat pour « {data.q} ».
					{:else}
						Aucun produit à afficher.
					{/if}
				</p>
				<p class="mt-2 text-sm text-shop-muted">
					Vérifiez l'orthographe, essayez une référence constructeur, ou appelez-nous au
					<a href="tel:0950922336" class="font-semibold text-shop-blue hover:underline">
						09 50 92 23 36
					</a>
					: nous identifions la pièce avec vous.
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

<script lang="ts">
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import SortSelect from '$lib/components/shop/SortSelect.svelte';
	import Pagination from '$lib/components/shop/Pagination.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const title = $derived(data.q ? `Résultats pour « ${data.q} »` : 'Tout le catalogue');
</script>

<svelte:head>
	<title>{title} — MS Shop</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<Breadcrumb items={[{ label: data.q ? 'Recherche' : 'Catalogue' }]} />

<header class="border-b border-shop-border pb-5">
	<h1 class="text-2xl font-extrabold tracking-tight text-shop-ink sm:text-3xl">{title}</h1>
	{#if !data.q}
		<p class="mt-2 text-sm text-shop-muted">
			Les dernières références ajoutées à notre catalogue. Utilisez la recherche ou les rayons pour
			affiner.
		</p>
	{/if}
</header>

<div class="mt-8 flex flex-wrap items-center justify-between gap-4">
	<p class="text-sm text-shop-muted">
		{#if data.products.rows.length > 0}
			{data.products.rows.length} produit{data.products.rows.length > 1 ? 's' : ''} sur cette page
		{/if}
	</p>
	<SortSelect sort={data.sort} />
</div>

{#if data.products.rows.length === 0}
	<div class="mt-10 rounded-2xl bg-shop-subtle px-6 py-12 text-center">
		<p class="font-semibold text-shop-ink">
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
	</div>
{:else}
	<div class="mt-5 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
		{#each data.products.rows as item (item.id)}
			<ProductCard product={item} />
		{/each}
	</div>
{/if}

<Pagination page={data.products.page} hasNextPage={data.products.hasNextPage} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { Breadcrumb, BreadcrumbItem, PaginationNav, Select } from 'flowbite-svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import type { ResolvedPathname } from '$app/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const sortOptions = [
		{ value: 'new', name: 'Nouveautés' },
		{ value: 'price_asc', name: 'Prix croissant' },
		{ value: 'price_desc', name: 'Prix décroissant' },
		{ value: 'name', name: 'Nom A → Z' }
	];

	function navigate(page: number, sort: string) {
		const qs = new SvelteURLSearchParams();
		if (data.q) qs.set('q', data.q);
		if (sort !== 'new') qs.set('tri', sort);
		if (page > 1) qs.set('page', String(page));
		const suffix = qs.toString();
		// Chemin résolu + query string : le cast conserve la garantie apportée par resolve().
		const target = (resolve('/(shop)/recherche') +
			(suffix ? `?${suffix}` : '')) as ResolvedPathname;
		goto(target);
	}
</script>

<svelte:head>
	<title>{data.q ? `Recherche « ${data.q} »` : 'Catalogue'} · MS Shop</title>
</svelte:head>

<Breadcrumb class="mb-4">
	<BreadcrumbItem home href={resolve('/')}>Accueil</BreadcrumbItem>
	<BreadcrumbItem>{data.q ? 'Recherche' : 'Catalogue'}</BreadcrumbItem>
</Breadcrumb>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-gray-900 uppercase">
			{#if data.q}
				Recherche : <span class="text-shop-orange">« {data.q} »</span>
			{:else}
				Notre <span class="text-shop-orange">catalogue</span>
			{/if}
		</h1>
		<p class="mt-1 text-sm text-gray-500">
			{data.products.total} résultat{data.products.total > 1 ? 's' : ''}
		</p>
	</div>
	<div class="w-48">
		<Select
			size="sm"
			items={sortOptions}
			value={data.sort}
			onchange={(e) => navigate(1, (e.currentTarget as HTMLSelectElement).value)}
			aria-label="Trier les résultats"
		/>
	</div>
</div>

{#if data.products.rows.length === 0}
	<div class="mt-10 rounded-lg bg-white p-10 text-center">
		<p class="text-lg font-medium text-gray-700">Aucun résultat pour « {data.q} »</p>
		<p class="mt-2 text-sm text-gray-500">
			Vérifiez l'orthographe ou essayez avec une référence constructeur ou un code EAN.
		</p>
	</div>
{:else}
	<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
		{#each data.products.rows as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>
{/if}

{#if data.products.pageCount > 1}
	<div class="mt-8 flex justify-center">
		<PaginationNav
			currentPage={data.products.page}
			totalPages={data.products.pageCount}
			onPageChange={(page) => navigate(page, data.sort)}
		/>
	</div>
{/if}

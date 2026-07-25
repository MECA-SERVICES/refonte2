<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { Breadcrumb, BreadcrumbItem, Button, PaginationNav, Select } from 'flowbite-svelte';
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
		if (sort !== 'new') qs.set('tri', sort);
		if (page > 1) qs.set('page', String(page));
		const suffix = qs.toString();
		// Chemin résolu + query string : le cast conserve la garantie apportée par resolve().
		const target = (resolve('/(shop)/categorie/[slug]', { slug: data.category.slug }) +
			(suffix ? `?${suffix}` : '')) as ResolvedPathname;
		goto(target, { noScroll: false });
	}
</script>

<svelte:head>
	<title>{data.category.name} · MS Shop</title>
</svelte:head>

<Breadcrumb class="mb-4">
	<BreadcrumbItem home href={resolve('/')}>Accueil</BreadcrumbItem>
	{#each data.breadcrumb as crumb, i (crumb.slug)}
		{#if i < data.breadcrumb.length - 1}
			<BreadcrumbItem href={resolve('/(shop)/categorie/[slug]', { slug: crumb.slug })}>
				{crumb.name}
			</BreadcrumbItem>
		{:else}
			<BreadcrumbItem>{crumb.name}</BreadcrumbItem>
		{/if}
	{/each}
</Breadcrumb>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-gray-900 uppercase">
			{data.category.name}
		</h1>
		<p class="mt-1 text-sm text-gray-500">
			{data.products.total} produit{data.products.total > 1 ? 's' : ''}
		</p>
	</div>
	<div class="w-48">
		<Select
			size="sm"
			items={sortOptions}
			value={data.sort}
			onchange={(e) => navigate(1, (e.currentTarget as HTMLSelectElement).value)}
			aria-label="Trier les produits"
		/>
	</div>
</div>

{#if data.category.description}
	<p class="mt-2 max-w-3xl text-sm text-gray-600">{data.category.description}</p>
{/if}

{#if data.children.length > 0}
	<div class="mt-4 flex flex-wrap gap-2">
		{#each data.children as child (child.id)}
			<Button
				size="xs"
				color="alternative"
				href={resolve('/(shop)/categorie/[slug]', { slug: child.slug })}
				class="border-gray-300 text-gray-700 hover:text-shop-blue"
			>
				{child.name}
			</Button>
		{/each}
	</div>
{/if}

{#if data.products.rows.length === 0}
	<p class="mt-10 rounded-lg bg-white p-8 text-center text-gray-500">
		Aucun produit dans cette catégorie pour le moment.
	</p>
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

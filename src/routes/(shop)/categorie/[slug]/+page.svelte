<script lang="ts">
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
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

<header class="border-b border-shop-border pb-5">
	<h1 class="text-2xl font-extrabold tracking-tight text-shop-ink sm:text-3xl">
		{data.category.name}
	</h1>
	{#if data.category.description}
		<div class="mt-2 max-w-3xl text-sm leading-6 text-shop-muted">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
			{@html data.category.description}
		</div>
	{/if}
</header>

{#if data.children.length > 0}
	<!-- Sous-rayons : l'entrée la plus directe vers le bon niveau du catalogue. -->
	<nav class="mt-6 flex flex-wrap gap-2" aria-label="Sous-catégories">
		{#each data.children as child (child.id)}
			<a
				href="/categorie/{child.slug}"
				class="rounded-full border border-shop-border bg-white px-4 py-1.5 text-sm font-medium text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
			>
				{child.name}
			</a>
		{/each}
	</nav>
{/if}

<div class="mt-8 flex flex-wrap items-center justify-between gap-4">
	<p class="text-sm text-shop-muted">
		{#if data.products.rows.length > 0}
			{data.products.rows.length} produit{data.products.rows.length > 1 ? 's' : ''} sur cette page
		{/if}
	</p>
	<SortSelect sort={data.sort} />
</div>

{#if data.products.rows.length === 0}
	<p class="mt-10 rounded-2xl bg-shop-subtle px-6 py-12 text-center text-shop-muted">
		Aucun produit dans ce rayon pour le moment.
		{#if data.children.length > 0}
			Explorez les sous-rayons ci-dessus.
		{/if}
	</p>
{:else}
	<div class="mt-5 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
		{#each data.products.rows as item (item.id)}
			<ProductCard product={item} />
		{/each}
	</div>
{/if}

<Pagination page={data.products.page} hasNextPage={data.products.hasNextPage} />

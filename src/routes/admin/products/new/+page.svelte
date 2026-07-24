<script lang="ts">
	import { PageHeader, ProductForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Nouveau produit · Administration</title></svelte:head>

<PageHeader
	title="Nouveau produit"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Produits', href: '/admin/products' },
		{ label: 'Nouveau' }
	]}
/>

<ProductForm
	brandOptions={data.brandOptions}
	categoryOptions={data.categoryOptions}
	message={form?.message}
	submitLabel="Créer le produit"
/>

<script lang="ts">
	import { PageHeader, CategoryForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Nouvelle catégorie · Administration</title></svelte:head>

<PageHeader
	title="Nouvelle catégorie"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Catégories', href: '/admin/categories' },
		{ label: 'Nouvelle' }
	]}
/>

<CategoryForm
	parentOptions={data.parentOptions}
	message={form?.message}
	submitLabel="Créer la catégorie"
/>

<script lang="ts">
	import { PageHeader, BrandForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Nouvelle marque · Administration</title></svelte:head>

<PageHeader
	title="Nouvelle marque"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Marques', href: '/admin/brands' },
		{ label: 'Nouvelle' }
	]}
/>

<BrandForm message={form?.message} submitLabel="Créer la marque" />

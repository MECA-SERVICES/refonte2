<script lang="ts">
	import { PageHeader, SupplierForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Nouveau fournisseur · Administration</title></svelte:head>

<PageHeader
	title="Nouveau fournisseur"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Fournisseurs', href: '/admin/suppliers' },
		{ label: 'Nouveau fournisseur' }
	]}
/>

<SupplierForm action="?/create" message={form?.message} submitLabel="Créer le fournisseur" />

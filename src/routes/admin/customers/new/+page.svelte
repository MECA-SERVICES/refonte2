<script lang="ts">
	import { PageHeader, CustomerForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Nouveau client · Administration</title></svelte:head>

<PageHeader
	title="Nouveau client"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Clients', href: '/admin/customers' },
		{ label: 'Nouveau' }
	]}
/>

<CustomerForm message={form?.message} submitLabel="Créer le client" />

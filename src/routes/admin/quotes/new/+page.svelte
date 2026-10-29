<script lang="ts">
	import { CustomerPicker, PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Nouveau devis : on choisit le client, ou on crée un client de passage sans
	 * compte web. Le devis s'ouvre aussitôt en brouillon.
	 */

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Nouveau devis · Administration</title></svelte:head>

<PageHeader
	title="Nouveau devis"
	subtitle="Choisissez le client : le devis s'ouvre en brouillon"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Devis', href: '/admin/quotes' },
		{ label: 'Nouveau devis' }
	]}
/>

<CustomerPicker
	term={data.term}
	customers={data.customers}
	basePath="/admin/quotes/new"
	pickLabel="Chiffrer"
	createLabel="Créer et chiffrer"
/>

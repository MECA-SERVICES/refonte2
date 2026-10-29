<script lang="ts">
	import { CustomerPicker, PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Nouvelle facture comptoir : on choisit le client, ou on crée un client de
	 * passage sans compte web. La facture s'ouvre aussitôt en brouillon.
	 */

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Nouvelle facture · Administration</title></svelte:head>

<PageHeader
	title="Nouvelle facture"
	subtitle="Choisissez le client : la facture s'ouvre en brouillon"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Factures comptoir', href: '/admin/invoices' },
		{ label: 'Nouvelle facture' }
	]}
/>

<CustomerPicker
	term={data.term}
	customers={data.customers}
	basePath="/admin/invoices/new"
	pickLabel="Facturer"
	createLabel="Créer et facturer"
/>

<script lang="ts">
	import { PageHeader, OrderStateForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Nouvel état · Administration</title></svelte:head>

<PageHeader
	title="Nouvel état de commande"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'États de commande', href: '/admin/order-states' },
		{ label: 'Nouveau' }
	]}
/>

<OrderStateForm message={form?.message} submitLabel="Créer l'état" />

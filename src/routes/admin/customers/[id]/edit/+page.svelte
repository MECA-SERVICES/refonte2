<script lang="ts">
	import { PageHeader, CustomerForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const c = $derived(data.customer);
</script>

<svelte:head><title>Modifier {c.firstName} {c.lastName} · Clients</title></svelte:head>

<PageHeader
	title="Modifier {c.firstName} {c.lastName}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Clients', href: '/admin/customers' },
		{ label: `${c.firstName} ${c.lastName}`, href: `/admin/customers/${c.id}` },
		{ label: 'Modifier' }
	]}
/>

<CustomerForm customer={c} message={form?.message} submitLabel="Enregistrer" />

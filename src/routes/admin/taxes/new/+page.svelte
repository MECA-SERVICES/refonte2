<script lang="ts">
	import { PageHeader, TaxRuleForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Nouveau taux de TVA · Administration</title></svelte:head>

<PageHeader
	title="Nouveau taux de TVA"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Taux de TVA', href: '/admin/taxes' },
		{ label: 'Nouveau' }
	]}
/>

<TaxRuleForm message={form?.message} submitLabel="Créer le taux" />

<script lang="ts">
	import { PageHeader, CmsPageForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Nouvelle page · Administration</title></svelte:head>

<PageHeader
	title="Nouvelle page"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Pages', href: '/admin/cms-pages' },
		{ label: 'Nouvelle page' }
	]}
/>

<CmsPageForm message={form?.message} submitLabel="Créer la page" />

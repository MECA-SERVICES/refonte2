<script lang="ts">
	import { PageHeader, PopupForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Nouvelle annonce · Administration</title></svelte:head>

<PageHeader
	title="Nouvelle annonce"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Annonces', href: '/admin/popups' },
		{ label: 'Nouvelle' }
	]}
/>

<PopupForm message={form?.message} submitLabel="Créer l'annonce" />

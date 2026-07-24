<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { PageHeader, BrandForm, ConfirmDialog } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const b = $derived(data.brand);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{b.name} · Marques</title></svelte:head>

<PageHeader
	title={b.name}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Marques', href: '/admin/brands' },
		{ label: b.name }
	]}
>
	{#snippet actions()}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<BrandForm brand={b} action="?/update" message={form?.message} submitLabel="Enregistrer" />

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer la marque"
	message="Les produits liés à cette marque ne seront pas supprimés mais perdront leur marque."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
